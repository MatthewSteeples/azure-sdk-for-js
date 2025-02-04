// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  isNode,
  TransferProgressEvent,
  TokenCredential,
  isTokenCredential
} from "@azure/core-http";
import { CanonicalCode } from "@azure/core-tracing";
import {
  BlobDownloadResponseModel,
  CpkInfo,
  DeleteSnapshotsOptionType,
  ModifiedAccessConditions,
  RehydratePriority,
  LeaseAccessConditions,
  BlobDownloadOptionalParams,
  BlobGetPropertiesResponse,
  BlobDeleteResponse,
  BlobUndeleteResponse,
  BlobHTTPHeaders,
  BlobSetHTTPHeadersResponse,
  BlobSetMetadataResponse,
  BlobCreateSnapshotResponse,
  BlobStartCopyFromURLResponse,
  BlobAbortCopyFromURLResponse,
  BlobCopyFromURLResponse,
  BlobSetTierResponse
} from "./generatedModels";
import { AbortSignalLike } from "@azure/abort-controller";
import { BlobDownloadResponse } from "./BlobDownloadResponse";
import { Blob } from "./generated/src/operations";
import { rangeToString } from "./Range";
import {
  BlobRequestConditions,
  Metadata,
  ensureCpkIfSpecified,
  BlockBlobTier,
  PremiumPageBlobTier,
  toAccessTier
} from "./models";
import { newPipeline, StoragePipelineOptions, Pipeline } from "./Pipeline";
import {
  DEFAULT_MAX_DOWNLOAD_RETRY_REQUESTS,
  URLConstants,
  DEFAULT_BLOB_DOWNLOAD_BLOCK_BYTES,
  DevelopmentConnectionString
} from "./utils/constants";
import {
  setURLParameter,
  extractConnectionStringParts,
  appendToURLPath,
  getValueInConnString
} from "./utils/utils.common";
import { readStreamToLocalFile } from "./utils/utils.node";
import { AppendBlobClient, StorageClient, CommonOptions } from "./internal";
import { BlockBlobClient } from "./internal";
import { PageBlobClient } from "./internal";
import { SharedKeyCredential } from "./credentials/SharedKeyCredential";
import { AnonymousCredential } from "./credentials/AnonymousCredential";
import { Batch } from "./utils/Batch";
import { streamToBuffer } from "./utils/utils.node";
import { BlobLeaseClient } from "./BlobLeaseClient";
import { createSpan } from "./utils/tracing";
import {
  BlobBeginCopyFromUrlPoller,
  BlobBeginCopyFromUrlPollState,
  CopyPollerBlobClient
} from "./pollers/BlobStartCopyFromUrlPoller";
import { PollerLike, PollOperationState } from "@azure/core-lro";

/**
 * Options to configure Blob - Begin Copy from URL operation.
 *
 * @export
 * @interface BlobBeginCopyFromURLOptions
 */
export interface BlobBeginCopyFromURLOptions extends BlobStartCopyFromURLOptions {
  /**
   * The amount of time in milliseconds the poller should wait between
   * calls to the service to determine the status of the Blob copy.
   * Defaults to 15 seconds.
   *
   * @type {number}
   * @memberof BlobBeginCopyFromURLOptions
   */
  intervalInMs?: number;
  /**
   * Callback to receive the state of the copy progress.
   *
   * @memberof BlobBeginCopyFromURLOptions
   */
  onProgress?: (state: BlobBeginCopyFromUrlPollState) => void;
  /**
   * Serialized poller state that can be used to resume polling from.
   * This may be useful when starting a copy on one process or thread
   * and you wish to continue polling on another process or thread.
   *
   * To get serialized poller state, call `poller.toString()` on an existing
   * poller.
   *
   * @memberof BlobBeginCopyFromURLOptions
   */
  resumeFrom?: string;
}

/**
 * Contains response data for the beginCopyFromURL operation.
 *
 * @export
 * @interface BlobBeginCopyFromURLResponse
 */
export interface BlobBeginCopyFromURLResponse extends BlobStartCopyFromURLResponse {}

/**
 * Options to configure Blob - Download operation.
 *
 * @export
 * @interface BlobDownloadOptions
 */
export interface BlobDownloadOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobDownloadOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * An opaque DateTime string value that, when present, specifies the blob snapshot to retrieve.
   *
   * @type {string}
   * @memberof BlobDownloadOptions
   */
  snapshot?: string;
  /**
   * When this is set to true and download range of blob, the service returns the MD5 hash for the range,
   * as long as the range is less than or equal to 4 MB in size.
   *
   * rangeGetContentCrc64 and rangeGetContentMD5 cannot be set at same time.
   *
   * @type {boolean}
   * @memberof BlobDownloadOptions
   */
  rangeGetContentMD5?: boolean;
  /**
   * When this is set to true and download range of blob, the service returns the CRC64 hash for the range,
   * as long as the range is less than or equal to 4 MB in size.
   *
   * rangeGetContentCrc64 and rangeGetContentMD5 cannot be set at same time.
   *
   * @type {boolean}
   * @memberof BlobDownloadOptions
   */
  rangeGetContentCrc64?: boolean;
  /**
   * Conditions to meet when downloading blobs.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobDownloadOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Call back to receive events on the progress of download operation.
   *
   * @memberof BlobDownloadOptions
   */
  onProgress?: (progress: TransferProgressEvent) => void;

  /**
   * Optional. ONLY AVAILABLE IN NODE.JS.
   *
   * How many retries will perform when original body download stream unexpected ends.
   * Above kind of ends will not trigger retry policy defined in a pipeline,
   * because they doesn't emit network errors.
   *
   * With this option, every additional retry means an additional FileClient.download() request will be made
   * from the broken point, until the requested range has been successfully downloaded or maxRetryRequests is reached.
   *
   * Default value is 5, please set a larger value when loading large files in poor network.
   *
   * @type {number}
   * @memberof BlobDownloadOptions
   */
  maxRetryRequests?: number;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobDownloadOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Exists operation.
 *
 * @export
 * @interface BlobExistsOptions
 */
export interface BlobExistsOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobGetPropertiesOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobSetHTTPHeadersOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Get Properties operation.
 *
 * @export
 * @interface BlobGetPropertiesOptions
 */
export interface BlobGetPropertiesOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobGetPropertiesOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when getting blob properties.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobGetPropertiesOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobGetPropertiesOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure the Blob - Delete operation.
 *
 * @export
 * @interface BlobDeleteOptions
 */
export interface BlobDeleteOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobDeleteOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when deleting blobs.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobDeleteOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Specifies options to delete blobs that have associated snapshots.
   * - `include`: Delete the base blob and all of its snapshots.
   * - `only`: Delete only the blob's snapshots and not the blob itself.
   *
   * @type {DeleteSnapshotsOptionType}
   * @memberof BlobDeleteOptions
   */
  deleteSnapshots?: DeleteSnapshotsOptionType;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobDeleteOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to confgiure Blob - Undelete operation.
 *
 * @export
 * @interface BlobUndeleteOptions
 */
export interface BlobUndeleteOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobUndeleteOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobUndeleteOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Set Http Headers operation.
 *
 * @export
 * @interface BlobSetHTTPHeadersOptions
 */
export interface BlobSetHTTPHeadersOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobSetHTTPHeadersOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when setting blob HTTP headers.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobSetHTTPHeadersOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobSetHTTPHeadersOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Set Metadata operation.
 *
 * @export
 * @interface BlobSetMetadataOptions
 */
export interface BlobSetMetadataOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobSetMetadataOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when setting blob metadata.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobSetMetadataOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobSetMetadataOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Acquire Lease operation.
 *
 * @export
 * @interface BlobAcquireLeaseOptions
 */
export interface BlobAcquireLeaseOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobAcquireLeaseOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when acquiring the lease of a blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobAcquireLeaseOptions
   */
  conditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Release Lease operation.
 *
 * @export
 * @interface BlobReleaseLeaseOptions
 */
export interface BlobReleaseLeaseOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobReleaseLeaseOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when releasing the lease of a blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobReleaseLeaseOptions
   */
  conditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Renew Lease operation.
 *
 * @export
 * @interface BlobRenewLeaseOptions
 */
export interface BlobRenewLeaseOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobRenewLeaseOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when renewing the lease of a blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobRenewLeaseOptions
   */
  conditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Change Lease operation.
 *
 * @export
 * @interface BlobChangeLeaseOptions
 */
export interface BlobChangeLeaseOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobChangeLeaseOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when changing the lease of a blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobChangeLeaseOptions
   */
  conditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Break Lease operation.
 *
 * @export
 * @interface BlobBreakLeaseOptions
 */
export interface BlobBreakLeaseOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobBreakLeaseOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * Conditions to meet when breaking the lease of a blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobBreakLeaseOptions
   */
  conditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Create Snapshot operation.
 *
 * @export
 * @interface BlobCreateSnapshotOptions
 */
export interface BlobCreateSnapshotOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobCreateSnapshotOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * A collection of key-value string pair to associate with the snapshot.
   *
   * @type {Metadata}
   * @memberof BlobCreateSnapshotOptions
   */
  metadata?: Metadata;
  /**
   * Conditions to meet when creating blob snapshots.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobCreateSnapshotOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Customer Provided Key Info.
   *
   * @type {CpkInfo}
   * @memberof BlobCreateSnapshotOptions
   */
  customerProvidedKey?: CpkInfo;
}

/**
 * Options to configure Blob - Start Copy from URL operation.
 *
 * @export
 * @interface BlobStartCopyFromURLOptions
 */
export interface BlobStartCopyFromURLOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobStartCopyFromURLOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * A collection of key-value string pair to associate with the blob that are being copied.
   *
   * @type {Metadata}
   * @memberof BlobStartCopyFromURLOptions
   */
  metadata?: Metadata;
  /**
   * Conditions to meet for the destination blob when copying from a URL to the blob.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobStartCopyFromURLOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Conditions to meet for the source Azure Blob/File when copying from a URL to the blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobStartCopyFromURLOptions
   */
  sourceConditions?: ModifiedAccessConditions;
  /**
   * Access tier.
   * More Details - https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-storage-tiers
   *
   * @type {BlockBlobTier | PremiumPageBlobTier | string}
   * @memberof BlobStartCopyFromURLOptions
   */
  tier?: BlockBlobTier | PremiumPageBlobTier | string;
  /**
   * Rehydrate Priority - possible values include 'High', 'Standard'.
   * More Details - https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-rehydration#rehydrate-an-archived-blob-to-an-online-tier
   *
   * @type {RehydratePriority}
   * @memberof BlobStartCopyFromURLOptions
   */
  rehydratePriority?: RehydratePriority;
}

/**
 * Options to configure Blob - Abort Copy from URL operation.
 *
 * @export
 * @interface BlobAbortCopyFromURLOptions
 */
export interface BlobAbortCopyFromURLOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobAbortCopyFromURLOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * If specified, contains the lease id that must be matched and lease with this id
   * must be active in order for the operation to succeed.
   *
   * @type {LeaseAccessConditions}
   * @memberof BlobAbortCopyFromURLOptions
   */
  conditions?: LeaseAccessConditions;
}

/**
 * Options to configure Blob - synchronous Copy From URL operation.
 *
 * @export
 * @interface BlobSyncCopyFromURLOptions
 */
export interface BlobSyncCopyFromURLOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobSyncCopyFromURLOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * A collection of key-value string pair to associate with the snapshot.
   *
   * @type {Metadata}
   * @memberof BlobSyncCopyFromURLOptions
   */
  metadata?: Metadata;
  /**
   * Conditions to meet for the destination blob when copying from a URL to the blob.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobSyncCopyFromURLOptions
   */
  conditions?: BlobRequestConditions;
  /**
   * Conditions to meet for the source Azure Blob/File when copying from a URL to the blob.
   *
   * @type {ModifiedAccessConditions}
   * @memberof BlobSyncCopyFromURLOptions
   */
  sourceConditions?: ModifiedAccessConditions;
}

/**
 * Options to configure Blob - Set Tier operation.
 *
 * @export
 * @interface BlobSetTierOptions
 */
export interface BlobSetTierOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobSetTierOptions
   */
  abortSignal?: AbortSignalLike;
  /**
   * If specified, contains the lease id that must be matched and lease with this id
   * must be active in order for the operation to succeed.
   *
   * @type {LeaseAccessConditions}
   * @memberof BlobSetTierOptions
   */
  conditions?: LeaseAccessConditions;
  /**
   * Rehydrate Priority - possible values include 'High', 'Standard'.
   * More Details - https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-rehydration#rehydrate-an-archived-blob-to-an-online-tier
   *
   * @type {RehydratePriority}
   * @memberof BlobSetTierOptions
   */
  rehydratePriority?: RehydratePriority;
}

/**
 * Option interface for BlobClient.downloadToBuffer().
 *
 * @export
 * @interface BlobDownloadToBufferOptions
 */
export interface BlobDownloadToBufferOptions extends CommonOptions {
  /**
   * An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   *
   * @type {AbortSignalLike}
   * @memberof BlobDownloadToBufferOptions
   */
  abortSignal?: AbortSignalLike;

  /**
   * blockSize is the data every request trying to download.
   * Must be >= 0, if set to 0 or undefined, blockSize will automatically calculated according
   * to the blob size.
   *
   * @type {number}
   * @memberof BlobDownloadToBufferOptions
   */
  blockSize?: number;

  /**
   * Optional. ONLY AVAILABLE IN NODE.JS.
   *
   * How many retries will perform when original block download stream unexpected ends.
   * Above kind of ends will not trigger retry policy defined in a pipeline,
   * because they doesn't emit network errors.
   *
   * With this option, every additional retry means an additional FileClient.download() request will be made
   * from the broken point, until the requested block has been successfully downloaded or
   * maxRetryRequestsPerBlock is reached.
   *
   * Default value is 5, please set a larger value when in poor network.
   *
   * @type {number}
   * @memberof DownloadFromAzureFileOptions
   */
  maxRetryRequestsPerBlock?: number;

  /**
   * Progress updater.
   *
   * @memberof BlobDownloadToBufferOptions
   */
  onProgress?: (progress: TransferProgressEvent) => void;

  /**
   * Access conditions headers.
   *
   * @type {BlobRequestConditions}
   * @memberof BlobDownloadToBufferOptions
   */
  conditions?: BlobRequestConditions;

  /**
   * Concurrency of parallel download.
   *
   * @type {number}
   * @memberof BlobDownloadToBufferOptions
   */
  concurrency?: number;
}

/**
 * A BlobClient represents a URL to an Azure Storage blob; the blob may be a block blob,
 * append blob, or page blob.
 *
 * @export
 * @class BlobClient
 */
export class BlobClient extends StorageClient {
  /**
   * blobContext provided by protocol layer.
   *
   * @private
   * @type {Blobs}
   * @memberof BlobClient
   */
  private blobContext: Blob;
  private _name: string;
  private _containerName: string;

  public get name(): string {
    return this._name;
  }

  public get containerName(): string {
    return this._containerName;
  }

  /**
   *
   * Creates an instance of BlobClient from connection string.
   *
   * @param {string} connectionString Account connection string or a SAS connection string of an Azure storage account.
   *                                  [ Note - Account connection string can only be used in NODE.JS runtime. ]
   *                                  Account connection string example -
   *                                  `DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=accountKey;EndpointSuffix=core.windows.net`
   *                                  SAS connection string example -
   *                                  `BlobEndpoint=https://myaccount.blob.core.windows.net/;QueueEndpoint=https://myaccount.queue.core.windows.net/;FileEndpoint=https://myaccount.file.core.windows.net/;TableEndpoint=https://myaccount.table.core.windows.net/;SharedAccessSignature=sasString`
   * @param {string} containerName Container name.
   * @param {string} blobName Blob name.
   * @param {StoragePipelineOptions} [options] Optional. Options to configure the HTTP pipeline.
   * @memberof BlobClient
   */
  constructor(
    connectionString: string,
    containerName: string,
    blobName: string,
    options?: StoragePipelineOptions
  );
  /**
   * Creates an instance of BlobClient.
   * This method accepts an encoded URL or non-encoded URL pointing to a blob.
   * Encoded URL string will NOT be escaped twice, only special characters in URL path will be escaped.
   * If a blob name includes ? or %, blob name must be encoded in the URL.
   *
   * @param {string} url A Client string pointing to Azure Storage blob service, such as
   *                     "https://myaccount.blob.core.windows.net". You can append a SAS
   *                     if using AnonymousCredential, such as "https://myaccount.blob.core.windows.net?sasString".
   * @param {SharedKeyCredential | AnonymousCredential | TokenCredential} credential Such as AnonymousCredential, SharedKeyCredential
   *                                                  or a TokenCredential from @azure/identity. If not specified,
   *                                                  AnonymousCredential is used.
   * @param {StoragePipelineOptions} [options] Optional. Options to configure the HTTP pipeline.
   * @memberof BlobClient
   */
  constructor(
    url: string,
    credential?: SharedKeyCredential | AnonymousCredential | TokenCredential,
    options?: StoragePipelineOptions
  );
  /**
   * Creates an instance of BlobClient.
   * This method accepts an encoded URL or non-encoded URL pointing to a blob.
   * Encoded URL string will NOT be escaped twice, only special characters in URL path will be escaped.
   * If a blob name includes ? or %, blob name must be encoded in the URL.
   *
   * @param {string} url A URL string pointing to Azure Storage blob, such as
   *                     "https://myaccount.blob.core.windows.net/mycontainer/blob".
   *                     You can append a SAS if using AnonymousCredential, such as
   *                     "https://myaccount.blob.core.windows.net/mycontainer/blob?sasString".
   *                     This method accepts an encoded URL or non-encoded URL pointing to a blob.
   *                     Encoded URL string will NOT be escaped twice, only special characters in URL path will be escaped.
   *                     However, if a blob name includes ? or %, blob name must be encoded in the URL.
   *                     Such as a blob named "my?blob%", the URL should be "https://myaccount.blob.core.windows.net/mycontainer/my%3Fblob%25".
   * @param {Pipeline} pipeline Call newPipeline() to create a default
   *                            pipeline, or provide a customized pipeline.
   * @memberof BlobClient
   */
  constructor(url: string, pipeline: Pipeline);
  constructor(
    urlOrConnectionString: string,
    credentialOrPipelineOrContainerName?:
      | string
      | SharedKeyCredential
      | AnonymousCredential
      | TokenCredential
      | Pipeline,
    blobNameOrOptions?: string | StoragePipelineOptions,
    options?: StoragePipelineOptions
  ) {
    options = options || {};
    let pipeline: Pipeline;
    let url: string;
    if (credentialOrPipelineOrContainerName instanceof Pipeline) {
      // (url: string, pipeline: Pipeline)
      url = urlOrConnectionString;
      pipeline = credentialOrPipelineOrContainerName;
    } else if (
      (isNode && credentialOrPipelineOrContainerName instanceof SharedKeyCredential) ||
      credentialOrPipelineOrContainerName instanceof AnonymousCredential ||
      isTokenCredential(credentialOrPipelineOrContainerName)
    ) {
      // (url: string, credential?: SharedKeyCredential | AnonymousCredential | TokenCredential, options?: StoragePipelineOptions)
      url = urlOrConnectionString;
      options = blobNameOrOptions as StoragePipelineOptions;
      pipeline = newPipeline(credentialOrPipelineOrContainerName, options);
    } else if (
      !credentialOrPipelineOrContainerName &&
      typeof credentialOrPipelineOrContainerName !== "string"
    ) {
      // (url: string, credential?: SharedKeyCredential | AnonymousCredential | TokenCredential, options?: StoragePipelineOptions)
      // The second parameter is undefined. Use anonymous credential.
      url = urlOrConnectionString;
      pipeline = newPipeline(new AnonymousCredential(), options);
    } else if (
      credentialOrPipelineOrContainerName &&
      typeof credentialOrPipelineOrContainerName === "string" &&
      blobNameOrOptions &&
      typeof blobNameOrOptions === "string"
    ) {
      // (connectionString: string, containerName: string, blobName: string, options?: StoragePipelineOptions)
      const containerName = credentialOrPipelineOrContainerName;
      const blobName = blobNameOrOptions;

      const extractedCreds = extractConnectionStringParts(urlOrConnectionString);
      if (extractedCreds.kind === "AccountConnString") {
        if (isNode) {
          const sharedKeyCredential = new SharedKeyCredential(
            extractedCreds.accountName!,
            extractedCreds.accountKey
          );
          url = appendToURLPath(
            appendToURLPath(extractedCreds.url, encodeURIComponent(containerName)),
            encodeURIComponent(blobName)
          );
          options.proxy = extractedCreds.proxyUri;
          pipeline = newPipeline(sharedKeyCredential, options);
        } else {
          throw new Error("Account connection string is only supported in Node.js environment");
        }
      } else if (extractedCreds.kind === "SASConnString") {
        url =
          appendToURLPath(
            appendToURLPath(extractedCreds.url, encodeURIComponent(containerName)),
            encodeURIComponent(blobName)
          ) +
          "?" +
          extractedCreds.accountSas;
        pipeline = newPipeline(new AnonymousCredential(), options);
      } else {
        throw new Error(
          "Connection string must be either an Account connection string or a SAS connection string"
        );
      }
    } else {
      throw new Error("Expecting non-empty strings for containerName and blobName parameters");
    }

    super(url, pipeline);
    ({
      blobName: this._name,
      containerName: this._containerName
    } = this.getBlobAndContainerNamesFromUrl());
    this.blobContext = new Blob(this.storageClientContext);
  }

  /**
   * Creates a new BlobClient object identical to the source but with the specified snapshot timestamp.
   * Provide "" will remove the snapshot and return a Client to the base blob.
   *
   * @param {string} snapshot The snapshot timestamp.
   * @returns {BlobClient} A new BlobClient object identical to the source but with the specified snapshot timestamp
   * @memberof BlobClient
   */
  public withSnapshot(snapshot: string): BlobClient {
    return new BlobClient(
      setURLParameter(
        this.url,
        URLConstants.Parameters.SNAPSHOT,
        snapshot.length === 0 ? undefined : snapshot
      ),
      this.pipeline
    );
  }

  /**
   * Creates a AppendBlobClient object.
   *
   * @returns {AppendBlobClient}
   * @memberof BlobClient
   */
  public getAppendBlobClient(): AppendBlobClient {
    return new AppendBlobClient(this.url, this.pipeline);
  }

  /**
   * Creates a BlockBlobClient object.
   *
   * @returns {BlockBlobClient}
   * @memberof BlobClient
   */
  public getBlockBlobClient(): BlockBlobClient {
    return new BlockBlobClient(this.url, this.pipeline);
  }

  /**
   * Creates a PageBlobClient object.
   *
   * @returns {PageBlobClient}
   * @memberof BlobClient
   */
  public getPageBlobClient(): PageBlobClient {
    return new PageBlobClient(this.url, this.pipeline);
  }

  /**
   * Reads or downloads a blob from the system, including its metadata and properties.
   * You can also call Get Blob to read a snapshot.
   *
   * * In Node.js, data returns in a Readable stream readableStreamBody
   * * In browsers, data returns in a promise blobBody
   *
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob
   *
   * @param {number} [offset] From which position of the blob to download, >= 0
   * @param {number} [count] How much data to be downloaded, > 0. Will download to the end when undefined
   * @param {BlobDownloadOptions} [options] Optional options to Blob Download operation.
   * @returns {Promise<BlobDownloadResponseModel>}
   * @memberof BlobClient
   */
  public async download(
    offset: number = 0,
    count?: number,
    options: BlobDownloadOptions = {}
  ): Promise<BlobDownloadResponseModel> {
    options.conditions = options.conditions || {};
    options.conditions = options.conditions || {};
    ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);

    const { span, spanOptions } = createSpan("BlobClient-download", options.spanOptions);

    try {
      const res = await this.blobContext.download({
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        onDownloadProgress: isNode ? undefined : options.onProgress,
        range: offset === 0 && !count ? undefined : rangeToString({ offset, count }),
        rangeGetContentMD5: options.rangeGetContentMD5,
        rangeGetContentCRC64: options.rangeGetContentCrc64,
        snapshot: options.snapshot,
        cpkInfo: options.customerProvidedKey,
        spanOptions
      });

      // Return browser response immediately
      if (!isNode) {
        return res;
      }

      // We support retrying when download stream unexpected ends in Node.js runtime
      // Following code shouldn't be bundled into browser build, however some
      // bundlers may try to bundle following code and "FileReadResponse.ts".
      // In this case, "FileDownloadResponse.browser.ts" will be used as a shim of "FileDownloadResponse.ts"
      // The config is in package.json "browser" field
      if (options.maxRetryRequests === undefined || options.maxRetryRequests < 0) {
        // TODO: Default value or make it a required parameter?
        options.maxRetryRequests = DEFAULT_MAX_DOWNLOAD_RETRY_REQUESTS;
      }

      if (res.contentLength === undefined) {
        throw new RangeError(`File download response doesn't contain valid content length header`);
      }

      if (!res.etag) {
        throw new RangeError(`File download response doesn't contain valid etag header`);
      }

      return new BlobDownloadResponse(
        res,
        async (start: number): Promise<NodeJS.ReadableStream> => {
          const updatedOptions: BlobDownloadOptionalParams = {
            leaseAccessConditions: options.conditions,
            modifiedAccessConditions: {
              ifMatch: options.conditions!.ifMatch || res.etag,
              ifModifiedSince: options.conditions!.ifModifiedSince,
              ifNoneMatch: options.conditions!.ifNoneMatch,
              ifUnmodifiedSince: options.conditions!.ifUnmodifiedSince
            },
            range: rangeToString({
              count: offset + res.contentLength! - start,
              offset: start
            }),
            rangeGetContentMD5: options.rangeGetContentMD5,
            rangeGetContentCRC64: options.rangeGetContentCrc64,
            snapshot: options.snapshot,
            cpkInfo: options.customerProvidedKey
          };

          // Debug purpose only
          // console.log(
          //   `Read from internal stream, range: ${
          //     updatedOptions.range
          //   }, options: ${JSON.stringify(updatedOptions)}`
          // );

          return (await this.blobContext.download({
            abortSignal: options.abortSignal,
            ...updatedOptions
          })).readableStreamBody!;
        },
        offset,
        res.contentLength!,
        {
          abortSignal: options.abortSignal,
          maxRetryRequests: options.maxRetryRequests,
          onProgress: options.onProgress
        }
      );
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Returns true if the Azrue blob resource represented by this client exists; false otherwise.
   *
   * NOTE: use this function with care since an existing blob might be deleted by other clients or
   * applications. Vice versa new blobs might be added by other clients or applications after this
   * function completes.
   *
   * @param {BlobExistsOptions} [options] options to Exists operation.
   * @returns {Promise<boolean>}
   * @memberof BlobClient
   */
  public async exists(options: BlobExistsOptions = {}): Promise<boolean> {
    const { span, spanOptions } = createSpan("BlobClient-exists", options.spanOptions);
    try {
      ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);
      await this.getProperties({
        abortSignal: options.abortSignal,
        customerProvidedKey: options.customerProvidedKey,
        spanOptions
      });
      return true;
    } catch (e) {
      if (e.statusCode === 404) {
        span.setStatus({
          code: CanonicalCode.NOT_FOUND,
          message: "Expected exception when checking blob existence"
        });
        return false;
      }
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Returns all user-defined metadata, standard HTTP properties, and system properties
   * for the blob. It does not return the content of the blob.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob-properties
   *
   * @param {BlobGetPropertiesOptions} [options] Optional options to Get Properties operation.
   * @returns {Promise<BlobGetPropertiesResponse>}
   * @memberof BlobClient
   */
  public async getProperties(
    options: BlobGetPropertiesOptions = {}
  ): Promise<BlobGetPropertiesResponse> {
    const { span, spanOptions } = createSpan("BlobClient-getProperties", options.spanOptions);
    try {
      options.conditions = options.conditions || {};
      ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);
      return this.blobContext.getProperties({
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        cpkInfo: options.customerProvidedKey,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Marks the specified blob or snapshot for deletion. The blob is later deleted
   * during garbage collection. Note that in order to delete a blob, you must delete
   * all of its snapshots. You can delete both at the same time with the Delete
   * Blob operation.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/delete-blob
   *
   * @param {BlobDeleteOptions} [options] Optional options to Blob Delete operation.
   * @returns {Promise<BlobDeleteResponse>}
   * @memberof BlobClient
   */
  public async delete(options: BlobDeleteOptions = {}): Promise<BlobDeleteResponse> {
    const { span, spanOptions } = createSpan("BlobClient-delete", options.spanOptions);
    options.conditions = options.conditions || {};
    try {
      return this.blobContext.deleteMethod({
        abortSignal: options.abortSignal,
        deleteSnapshots: options.deleteSnapshots,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Restores the contents and metadata of soft deleted blob and any associated
   * soft deleted snapshots. Undelete Blob is supported only on version 2017-07-29
   * or later.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/undelete-blob
   *
   * @param {BlobUndeleteOptions} [options] Optional options to Blob Undelete operation.
   * @returns {Promise<BlobUndeleteResponse>}
   * @memberof BlobClient
   */
  public async undelete(options: BlobUndeleteOptions = {}): Promise<BlobUndeleteResponse> {
    const { span, spanOptions } = createSpan("BlobClient-undelete", options.spanOptions);
    try {
      return this.blobContext.undelete({
        abortSignal: options.abortSignal,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets system properties on the blob.
   *
   * If no value provided, or no value provided for the specificed blob HTTP headers,
   * these blob HTTP headers without a value will be cleared.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-properties
   *
   * @param {BlobHTTPHeaders} [blobHTTPHeaders] If no value provided, or no value provided for
   *                                                   the specificed blob HTTP headers, these blob HTTP
   *                                                   headers without a value will be cleared.
   * @param {BlobSetHTTPHeadersOptions} [options] Optional options to Blob Set HTTP Headers operation.
   * @returns {Promise<BlobSetHTTPHeadersResponse>}
   * @memberof BlobClient
   */
  public async setHTTPHeaders(
    blobHTTPHeaders?: BlobHTTPHeaders,
    options: BlobSetHTTPHeadersOptions = {}
  ): Promise<BlobSetHTTPHeadersResponse> {
    const { span, spanOptions } = createSpan("BlobClient-setHTTPHeaders", options.spanOptions);
    options.conditions = options.conditions || {};
    try {
      ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);
      return this.blobContext.setHTTPHeaders({
        abortSignal: options.abortSignal,
        blobHTTPHeaders,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        cpkInfo: options.customerProvidedKey,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets user-defined metadata for the specified blob as one or more name-value pairs.
   *
   * If no option provided, or no metadata defined in the parameter, the blob
   * metadata will be removed.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-metadata
   *
   * @param {Metadata} [metadata] Replace existing metadata with this value.
   *                               If no value provided the existing metadata will be removed.
   * @param {BlobSetMetadataOptions} [options] Optional options to Set Metadata operation.
   * @returns {Promise<BlobSetMetadataResponse>}
   * @memberof BlobClient
   */
  public async setMetadata(
    metadata?: Metadata,
    options: BlobSetMetadataOptions = {}
  ): Promise<BlobSetMetadataResponse> {
    const { span, spanOptions } = createSpan("BlobClient-setMetadata", options.spanOptions);
    options.conditions = options.conditions || {};
    try {
      ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);
      return this.blobContext.setMetadata({
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        metadata,
        modifiedAccessConditions: options.conditions,
        cpkInfo: options.customerProvidedKey,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Get a BlobLeaseClient that manages leases on the blob.
   *
   * @param {string} [proposeLeaseId] Initial proposed lease Id.
   * @returns {BlobLeaseClient} A new BlobLeaseClient object for managing leases on the blob.
   * @memberof BlobClient
   */
  public getBlobLeaseClient(proposeLeaseId?: string): BlobLeaseClient {
    return new BlobLeaseClient(this, proposeLeaseId);
  }

  /**
   * Creates a read-only snapshot of a blob.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/snapshot-blob
   *
   * @param {BlobCreateSnapshotOptions} [options] Optional options to the Blob Create Snapshot operation.
   * @returns {Promise<BlobCreateSnapshotResponse>}
   * @memberof BlobClient
   */
  public async createSnapshot(
    options: BlobCreateSnapshotOptions = {}
  ): Promise<BlobCreateSnapshotResponse> {
    const { span, spanOptions } = createSpan("BlobClient-createSnapshot", options.spanOptions);
    options.conditions = options.conditions || {};
    try {
      ensureCpkIfSpecified(options.customerProvidedKey, this.isHttps);
      return this.blobContext.createSnapshot({
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        metadata: options.metadata,
        modifiedAccessConditions: options.conditions,
        cpkInfo: options.customerProvidedKey,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Asynchronously copies a blob to a destination within the storage account.
   * This method returns a long running operation poller that allows you to wait
   * indefinitely until the copy is completed.
   * You can also cancel a copy before it is completed by calling `cancelOperation` on the poller.
   *
   * In version 2012-02-12 and later, the source for a Copy Blob operation can be
   * a committed blob in any Azure storage account.
   * Beginning with version 2015-02-21, the source for a Copy Blob operation can be
   * an Azure file in any Azure storage account.
   * Only storage accounts created on or after June 7th, 2012 allow the Copy Blob
   * operation to copy from another storage account.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/copy-blob
   *
   * Example usage of automatic polling:
   * ```js
   * const copyPoller = await blobClient.beginCopyFromURL('url');
   * const result = await copyPoller.pollUntilDone();
   * ```
   *
   * Example usage of manual polling:
   * ```js
   * const copyPoller = await blobClient.beginCopyFromURL('url');
   * while (!poller.isDone()) {
   *    await poller.poll();
   * }
   * const result = copyPoller.getResult();
   * ```
   *
   * Example usage of progress updates:
   * ```js
   * const copyPoller = await blobClient.beginCopyFromURL('url', {
   *   onProgress(state) {
   *     console.log(`Progress: ${state.copyProgress}`);
   *   }
   * });
   * const result = await copyPoller.pollUntilDone();
   * ```
   *
   * Example usage of changing polling interval (default 15 seconds):
   * ```js
   * const copyPoller = await blobClient.beginCopyFromURL('url', {
   *   intervalInMs: 1000 // poll blob every 1 second for copy progress
   * });
   * const result = await copyPoller.pollUntilDone();
   * ```
   *
   * Example usage of copy cancellation:
   * ```js
   * const copyPoller = await blobClient.beginCopyFromURL('url');
   * // cancel operation after starting it.
   * try {
   *   await copyPoller.cancelOperation();
   *   // calls to get the result now throw PollerCancelledError
   *   await copyPoller.getResult();
   * } catch (err) {
   *   if (err.name === 'PollerCancelledError') {
   *     console.log('The copy was cancelled.');
   *   }
   * }
   * ```
   *
   * @param {string} copySource url to the source Azure Blob/File.
   * @param {BlobBeginCopyFromURLOptions} [options] Optional options to the Blob Start Copy From URL operation.
   */
  public async beginCopyFromURL(
    copySource: string,
    options: BlobBeginCopyFromURLOptions = {}
  ): Promise<
    PollerLike<PollOperationState<BlobBeginCopyFromURLResponse>, BlobBeginCopyFromURLResponse>
  > {
    const client: CopyPollerBlobClient = {
      abortCopyFromURL: (...args) => this.abortCopyFromURL(...args),
      getProperties: (...args) => this.getProperties(...args),
      startCopyFromURL: (...args) => this.startCopyFromURL(...args)
    };
    const poller = new BlobBeginCopyFromUrlPoller({
      blobClient: client,
      copySource,
      intervalInMs: options.intervalInMs,
      onProgress: options.onProgress,
      resumeFrom: options.resumeFrom,
      startCopyFromURLOptions: options
    });

    // Trigger the startCopyFromURL call by calling poll.
    // Any errors from this method should be surfaced to the user.
    await poller.poll();

    return poller;
  }

  /**
   * Aborts a pending asynchronous Copy Blob operation, and leaves a destination blob with zero
   * length and full metadata. Version 2012-02-12 and newer.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/abort-copy-blob
   *
   * @param {string} copyId Id of the Copy From URL operation.
   * @param {BlobAbortCopyFromURLOptions} [options] Optional options to the Blob Abort Copy From URL operation.
   * @returns {Promise<BlobAbortCopyFromURLResponse>}
   * @memberof BlobClient
   */
  public async abortCopyFromURL(
    copyId: string,
    options: BlobAbortCopyFromURLOptions = {}
  ): Promise<BlobAbortCopyFromURLResponse> {
    const { span, spanOptions } = createSpan("BlobClient-abortCopyFromURL", options.spanOptions);
    try {
      return this.blobContext.abortCopyFromURL(copyId, {
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * The synchronous Copy From URL operation copies a blob or an internet resource to a new blob. It will not
   * return a response until the copy is complete.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/copy-blob-from-url
   *
   * @param {string} copySource The source URL to copy from, Shared Access Signature(SAS) maybe needed for authentication
   * @param {BlobSyncCopyFromURLOptions} [options={}]
   * @returns {Promise<BlobCopyFromURLResponse>}
   * @memberof BlobURL
   */
  public async syncCopyFromURL(
    copySource: string,
    options: BlobSyncCopyFromURLOptions = {}
  ): Promise<BlobCopyFromURLResponse> {
    const { span, spanOptions } = createSpan("BlobClient-syncCopyFromURL", options.spanOptions);
    options.conditions = options.conditions || {};
    options.sourceConditions = options.sourceConditions || {};

    try {
      return this.blobContext.copyFromURL(copySource, {
        abortSignal: options.abortSignal,
        metadata: options.metadata,
        leaseAccessConditions: options.conditions,
        modifiedAccessConditions: options.conditions,
        sourceModifiedAccessConditions: {
          sourceIfMatch: options.sourceConditions.ifMatch,
          sourceIfModifiedSince: options.sourceConditions.ifModifiedSince,
          sourceIfNoneMatch: options.sourceConditions.ifNoneMatch,
          sourceIfUnmodifiedSince: options.sourceConditions.ifUnmodifiedSince
        },
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * Sets the tier on a blob. The operation is allowed on a page blob in a premium
   * storage account and on a block blob in a blob storage account (locally redundant
   * storage only). A premium page blob's tier determines the allowed size, IOPS,
   * and bandwidth of the blob. A block blob's tier determines Hot/Cool/Archive
   * storage type. This operation does not update the blob's ETag.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-tier
   *
   * @param {BlockBlobTier | PremiumPageBlobTier | string} tier The tier to be set on the blob. Valid values are Hot, Cool, or Archive.
   * @param {BlobSetTierOptions} [options] Optional options to the Blob Set Tier operation.
   * @returns {Promise<BlobsSetTierResponse>}
   * @memberof BlobClient
   */
  public async setAccessTier(
    tier: BlockBlobTier | PremiumPageBlobTier | string,
    options: BlobSetTierOptions = {}
  ): Promise<BlobSetTierResponse> {
    const { span, spanOptions } = createSpan("BlobClient-setAccessTier", options.spanOptions);
    try {
      return await this.blobContext.setTier(toAccessTier(tier)!, {
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        rehydratePriority: options.rehydratePriority,
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  // High level function

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Downloads an Azure Blob in parallel to a buffer.
   * Offset and count are optional, downloads the entire blob if they are not provided.
   *
   * @export
   * @param {number} offset From which position of the block blob to download(in bytes)
   * @param {number} [count] How much data(in bytes) to be downloaded. Will download to the end when passing undefined
   * @param {BlobDownloadToBufferOptions} [options] BlobDownloadToBufferOptions
   * @returns {Promise<Buffer>}
   */
  public async downloadToBuffer(
    offset?: number,
    count?: number,
    options?: BlobDownloadToBufferOptions
  ): Promise<Buffer>;

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Downloads an Azure Blob in parallel to a buffer.
   * Offset and count are optional, downloads the entire blob if they are not provided.
   *
   * @export
   * @param {Buffer} buffer Buffer to be fill, must have length larger than count
   * @param {number} offset From which position of the block blob to download(in bytes)
   * @param {number} [count] How much data(in bytes) to be downloaded. Will download to the end when passing undefined
   * @param {BlobDownloadToBufferOptions} [options] BlobDownloadToBufferOptions
   * @returns {Promise<Buffer>}
   */
  public async downloadToBuffer(
    buffer: Buffer,
    offset?: number,
    count?: number,
    options?: BlobDownloadToBufferOptions
  ): Promise<Buffer>;

  public async downloadToBuffer(
    param1?: Buffer | number,
    param2?: number,
    param3?: BlobDownloadToBufferOptions | number,
    param4: BlobDownloadToBufferOptions = {}
  ) {
    let buffer: Buffer | undefined;
    let offset = 0;
    let count = 0;
    let options = param4;
    if (param1 instanceof Buffer) {
      buffer = param1;
      offset = param2 || 0;
      count = typeof param3 === "number" ? param3 : 0;
    } else {
      offset = typeof param1 === "number" ? param1 : 0;
      count = typeof param2 === "number" ? param2 : 0;
      options = (param3 as BlobDownloadToBufferOptions) || {};
    }
    const { span, spanOptions } = createSpan("BlobClient-downloadToBuffer", options.spanOptions);

    try {
      if (!options.blockSize) {
        options.blockSize = 0;
      }
      if (options.blockSize < 0) {
        throw new RangeError("blockSize option must be >= 0");
      }
      if (options.blockSize === 0) {
        options.blockSize = DEFAULT_BLOB_DOWNLOAD_BLOCK_BYTES;
      }

      if (offset < 0) {
        throw new RangeError("offset option must be >= 0");
      }

      if (count && count <= 0) {
        throw new RangeError("count option must be > 0");
      }

      if (!options.conditions) {
        options.conditions = {};
      }

      // Customer doesn't specify length, get it
      if (!count) {
        const response = await this.getProperties({
          ...options,
          spanOptions
        });
        count = response.contentLength! - offset;
        if (count < 0) {
          throw new RangeError(
            `offset ${offset} shouldn't be larger than blob size ${response.contentLength!}`
          );
        }
      }

      // Allocate the buffer of size = count if the buffer is not provided
      if (!buffer) {
        try {
          buffer = Buffer.alloc(count);
        } catch (error) {
          throw new Error(
            `Unable to allocate the buffer of size: ${count}(in bytes). Please try passing your own buffer to the "downloadToBuffer" method or try using other methods like "download" or "downloadToFile".\t ${error.message}`
          );
        }
      }

      if (buffer.length < count) {
        throw new RangeError(
          `The buffer's size should be equal to or larger than the request count of bytes: ${count}`
        );
      }

      let transferProgress: number = 0;
      const batch = new Batch(options.concurrency);
      for (let off = offset; off < offset + count; off = off + options.blockSize) {
        batch.addOperation(async () => {
          // Exclusive chunk end position
          let chunkEnd = offset + count!;
          if (off + options.blockSize! < chunkEnd) {
            chunkEnd = off + options.blockSize!;
          }
          const response = await this.download(off, chunkEnd - off, {
            abortSignal: options.abortSignal,
            conditions: options.conditions,
            maxRetryRequests: options.maxRetryRequestsPerBlock,
            spanOptions
          });
          const stream = response.readableStreamBody!;
          await streamToBuffer(stream, buffer!, off - offset, chunkEnd - offset);
          // Update progress after block is downloaded, in case of block trying
          // Could provide finer grained progress updating inside HTTP requests,
          // only if convenience layer download try is enabled
          transferProgress += chunkEnd - off;
          if (options.onProgress) {
            options.onProgress({ loadedBytes: transferProgress });
          }
        });
      }
      await batch.do();
      return buffer;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  /**
   * ONLY AVAILABLE IN NODE.JS RUNTIME.
   *
   * Downloads an Azure Blob to a local file.
   * Fails if the the given file path already exits.
   * Offset and count are optional, pass 0 and undefined respectively to download the entire blob.
   *
   * @param {string} filePath
   * @param {number} [offset] From which position of the block blob to download.
   * @param {number} [count] How much data to be downloaded. Will download to the end when passing undefined.
   * @param {BlobDownloadOptions} [options] Options to Blob download options.
   * @returns {Promise<BlobDownloadResponseModel>} The response data for blob download operation,
   *                                                 but with readableStreamBody set to undefined since its
   *                                                 content is already read and written into a local file
   *                                                 at the specified path.
   * @memberof BlobClient
   */
  public async downloadToFile(
    filePath: string,
    offset: number = 0,
    count?: number,
    options: BlobDownloadOptions = {}
  ): Promise<BlobDownloadResponseModel> {
    const { span, spanOptions } = createSpan("BlobClient-downloadToFile", options.spanOptions);
    try {
      const response = await this.download(offset, count, {
        ...options,
        spanOptions
      });
      if (response.readableStreamBody) {
        await readStreamToLocalFile(response.readableStreamBody, filePath);
      }

      // The stream is no longer accessible so setting it to undefined.
      (response as any).blobDownloadStream = undefined;
      return response;
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }

  private getBlobAndContainerNamesFromUrl(): { blobName: string; containerName: string } {
    let containerName;
    let blobName;
    try {
      //  URL may look like the following
      // "https://myaccount.blob.core.windows.net/mycontainer/blob?sasString";
      // "https://myaccount.blob.core.windows.net/mycontainer/blob";
      // "https://myaccount.blob.core.windows.net/mycontainer/blob/a.txt?sasString";
      // "https://myaccount.blob.core.windows.net/mycontainer/blob/a.txt";
      // or an emulator URL that starts with the endpoint `http://127.0.0.1:10000/devstoreaccount1`

      let urlWithoutSAS = this.url.split("?")[0]; // removing the sas part of url if present
      urlWithoutSAS = urlWithoutSAS.endsWith("/") ? urlWithoutSAS.slice(0, -1) : urlWithoutSAS; // Slicing off '/' at the end if exists

      // http://127.0.0.1:10000/devstoreaccount1
      const emulatorBlobEndpoint = getValueInConnString(
        DevelopmentConnectionString,
        "BlobEndpoint"
      );

      if (this.url.startsWith(emulatorBlobEndpoint)) {
        // Emulator URL starts with `http://127.0.0.1:10000/devstoreaccount1`
        const partsOfUrl = urlWithoutSAS.match(emulatorBlobEndpoint + "/([^/]*)(/(.*))?");
        containerName = partsOfUrl![1];
        blobName = partsOfUrl![3];
      } else {
        const partsOfUrl = urlWithoutSAS.match("([^/]*)://([^/]*)/([^/]*)(/(.*))?");
        containerName = partsOfUrl![3];
        blobName = partsOfUrl![5];
      }

      // decode the encoded blobName, containerName - to get all the special characters that might be present in them
      containerName = decodeURIComponent(containerName);
      blobName = decodeURIComponent(blobName);

      // Azure Storage Server will replace "\" with "/" in the blob names
      //   doing the same in the SDK side so that the user doesn't have to replace "\" instances in the blobName
      blobName = blobName.replace(/\\/g, "/");

      if (!blobName) {
        throw new Error("Provided blobName is invalid.");
      } else if (!containerName) {
        throw new Error("Provided containerName is invalid.");
      } else {
        return { blobName, containerName };
      }
    } catch (error) {
      throw new Error("Unable to extract blobName and containerName with provided information.");
    }
  }

  /**
   * Asynchronously copies a blob to a destination within the storage account.
   * In version 2012-02-12 and later, the source for a Copy Blob operation can be
   * a committed blob in any Azure storage account.
   * Beginning with version 2015-02-21, the source for a Copy Blob operation can be
   * an Azure file in any Azure storage account.
   * Only storage accounts created on or after June 7th, 2012 allow the Copy Blob
   * operation to copy from another storage account.
   * @see https://docs.microsoft.com/en-us/rest/api/storageservices/copy-blob
   *
   * @param {string} copySource url to the source Azure Blob/File.
   * @param {BlobStartCopyFromURLOptions} [options] Optional options to the Blob Start Copy From URL operation.
   * @returns {Promise<BlobStartCopyFromURLResponse>}
   * @memberof BlobClient
   */
  private async startCopyFromURL(
    copySource: string,
    options: BlobStartCopyFromURLOptions = {}
  ): Promise<BlobStartCopyFromURLResponse> {
    const { span, spanOptions } = createSpan("BlobClient-startCopyFromURL", options.spanOptions);
    options.conditions = options.conditions || {};
    options.sourceConditions = options.sourceConditions || {};

    try {
      return this.blobContext.startCopyFromURL(copySource, {
        abortSignal: options.abortSignal,
        leaseAccessConditions: options.conditions,
        metadata: options.metadata,
        modifiedAccessConditions: options.conditions,
        sourceModifiedAccessConditions: {
          sourceIfMatch: options.sourceConditions.ifMatch,
          sourceIfModifiedSince: options.sourceConditions.ifModifiedSince,
          sourceIfNoneMatch: options.sourceConditions.ifNoneMatch,
          sourceIfUnmodifiedSince: options.sourceConditions.ifUnmodifiedSince
        },
        rehydratePriority: options.rehydratePriority,
        tier: toAccessTier(options.tier),
        spanOptions
      });
    } catch (e) {
      span.setStatus({
        code: CanonicalCode.UNKNOWN,
        message: e.message
      });
      throw e;
    } finally {
      span.end();
    }
  }
}
