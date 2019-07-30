/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as msRest from "@azure/ms-rest-js";
import * as Models from "../models";
import * as Mappers from "../models/subscriptionsMappers";
import * as Parameters from "../models/parameters";
import { SubscriptionClientContext } from "../subscriptionClientContext";

/** Class representing a Subscriptions. */
export class Subscriptions {
  private readonly client: SubscriptionClientContext;

  /**
   * Create a Subscriptions.
   * @param {SubscriptionClientContext} client Reference to the service client.
   */
  constructor(client: SubscriptionClientContext) {
    this.client = client;
  }

  /**
   * Cancels the subscription
   * @param subscriptionId Subscription Id.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsCancelResponse>
   */
  cancel(subscriptionId: string, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsCancelResponse>;
  /**
   * @param subscriptionId Subscription Id.
   * @param callback The callback
   */
  cancel(subscriptionId: string, callback: msRest.ServiceCallback<Models.CanceledSubscriptionId>): void;
  /**
   * @param subscriptionId Subscription Id.
   * @param options The optional parameters
   * @param callback The callback
   */
  cancel(subscriptionId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.CanceledSubscriptionId>): void;
  cancel(subscriptionId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.CanceledSubscriptionId>, callback?: msRest.ServiceCallback<Models.CanceledSubscriptionId>): Promise<Models.SubscriptionsCancelResponse> {
    return this.client.sendOperationRequest(
      {
        subscriptionId,
        options
      },
      cancelOperationSpec,
      callback) as Promise<Models.SubscriptionsCancelResponse>;
  }

  /**
   * Renames the subscription
   * @param subscriptionId Subscription Id.
   * @param body Subscription Name
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsRenameResponse>
   */
  rename(subscriptionId: string, body: Models.SubscriptionName, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsRenameResponse>;
  /**
   * @param subscriptionId Subscription Id.
   * @param body Subscription Name
   * @param callback The callback
   */
  rename(subscriptionId: string, body: Models.SubscriptionName, callback: msRest.ServiceCallback<Models.RenamedSubscriptionId>): void;
  /**
   * @param subscriptionId Subscription Id.
   * @param body Subscription Name
   * @param options The optional parameters
   * @param callback The callback
   */
  rename(subscriptionId: string, body: Models.SubscriptionName, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.RenamedSubscriptionId>): void;
  rename(subscriptionId: string, body: Models.SubscriptionName, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.RenamedSubscriptionId>, callback?: msRest.ServiceCallback<Models.RenamedSubscriptionId>): Promise<Models.SubscriptionsRenameResponse> {
    return this.client.sendOperationRequest(
      {
        subscriptionId,
        body,
        options
      },
      renameOperationSpec,
      callback) as Promise<Models.SubscriptionsRenameResponse>;
  }

  /**
   * Enables the subscription
   * @param subscriptionId Subscription Id.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsEnableResponse>
   */
  enable(subscriptionId: string, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsEnableResponse>;
  /**
   * @param subscriptionId Subscription Id.
   * @param callback The callback
   */
  enable(subscriptionId: string, callback: msRest.ServiceCallback<Models.EnabledSubscriptionId>): void;
  /**
   * @param subscriptionId Subscription Id.
   * @param options The optional parameters
   * @param callback The callback
   */
  enable(subscriptionId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.EnabledSubscriptionId>): void;
  enable(subscriptionId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.EnabledSubscriptionId>, callback?: msRest.ServiceCallback<Models.EnabledSubscriptionId>): Promise<Models.SubscriptionsEnableResponse> {
    return this.client.sendOperationRequest(
      {
        subscriptionId,
        options
      },
      enableOperationSpec,
      callback) as Promise<Models.SubscriptionsEnableResponse>;
  }

  /**
   * This operation provides all the locations that are available for resource providers; however,
   * each resource provider may support a subset of this list.
   * @summary Gets all available geo-locations.
   * @param subscriptionId The ID of the target subscription.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsListLocationsResponse>
   */
  listLocations(subscriptionId: string, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsListLocationsResponse>;
  /**
   * @param subscriptionId The ID of the target subscription.
   * @param callback The callback
   */
  listLocations(subscriptionId: string, callback: msRest.ServiceCallback<Models.LocationListResult>): void;
  /**
   * @param subscriptionId The ID of the target subscription.
   * @param options The optional parameters
   * @param callback The callback
   */
  listLocations(subscriptionId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.LocationListResult>): void;
  listLocations(subscriptionId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.LocationListResult>, callback?: msRest.ServiceCallback<Models.LocationListResult>): Promise<Models.SubscriptionsListLocationsResponse> {
    return this.client.sendOperationRequest(
      {
        subscriptionId,
        options
      },
      listLocationsOperationSpec,
      callback) as Promise<Models.SubscriptionsListLocationsResponse>;
  }

  /**
   * Gets details about a specified subscription.
   * @param subscriptionId The ID of the target subscription.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsGetResponse>
   */
  get(subscriptionId: string, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsGetResponse>;
  /**
   * @param subscriptionId The ID of the target subscription.
   * @param callback The callback
   */
  get(subscriptionId: string, callback: msRest.ServiceCallback<Models.Subscription>): void;
  /**
   * @param subscriptionId The ID of the target subscription.
   * @param options The optional parameters
   * @param callback The callback
   */
  get(subscriptionId: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.Subscription>): void;
  get(subscriptionId: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.Subscription>, callback?: msRest.ServiceCallback<Models.Subscription>): Promise<Models.SubscriptionsGetResponse> {
    return this.client.sendOperationRequest(
      {
        subscriptionId,
        options
      },
      getOperationSpec,
      callback) as Promise<Models.SubscriptionsGetResponse>;
  }

  /**
   * Gets all subscriptions for a tenant.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsListResponse>
   */
  list(options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsListResponse>;
  /**
   * @param callback The callback
   */
  list(callback: msRest.ServiceCallback<Models.SubscriptionListResult>): void;
  /**
   * @param options The optional parameters
   * @param callback The callback
   */
  list(options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.SubscriptionListResult>): void;
  list(options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.SubscriptionListResult>, callback?: msRest.ServiceCallback<Models.SubscriptionListResult>): Promise<Models.SubscriptionsListResponse> {
    return this.client.sendOperationRequest(
      {
        options
      },
      listOperationSpec,
      callback) as Promise<Models.SubscriptionsListResponse>;
  }

  /**
   * Gets all subscriptions for a tenant.
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param [options] The optional parameters
   * @returns Promise<Models.SubscriptionsListNextResponse>
   */
  listNext(nextPageLink: string, options?: msRest.RequestOptionsBase): Promise<Models.SubscriptionsListNextResponse>;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param callback The callback
   */
  listNext(nextPageLink: string, callback: msRest.ServiceCallback<Models.SubscriptionListResult>): void;
  /**
   * @param nextPageLink The NextLink from the previous successful call to List operation.
   * @param options The optional parameters
   * @param callback The callback
   */
  listNext(nextPageLink: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<Models.SubscriptionListResult>): void;
  listNext(nextPageLink: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<Models.SubscriptionListResult>, callback?: msRest.ServiceCallback<Models.SubscriptionListResult>): Promise<Models.SubscriptionsListNextResponse> {
    return this.client.sendOperationRequest(
      {
        nextPageLink,
        options
      },
      listNextOperationSpec,
      callback) as Promise<Models.SubscriptionsListNextResponse>;
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const cancelOperationSpec: msRest.OperationSpec = {
  httpMethod: "POST",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Subscription/cancel",
  urlParameters: [
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion0
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.CanceledSubscriptionId
    },
    default: {
      bodyMapper: Mappers.ErrorResponse
    }
  },
  serializer
};

const renameOperationSpec: msRest.OperationSpec = {
  httpMethod: "POST",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Subscription/rename",
  urlParameters: [
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion0
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  requestBody: {
    parameterPath: "body",
    mapper: {
      ...Mappers.SubscriptionName,
      required: true
    }
  },
  responses: {
    200: {
      bodyMapper: Mappers.RenamedSubscriptionId
    },
    default: {
      bodyMapper: Mappers.ErrorResponse
    }
  },
  serializer
};

const enableOperationSpec: msRest.OperationSpec = {
  httpMethod: "POST",
  path: "subscriptions/{subscriptionId}/providers/Microsoft.Subscription/enable",
  urlParameters: [
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion0
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.EnabledSubscriptionId
    },
    default: {
      bodyMapper: Mappers.ErrorResponse
    }
  },
  serializer
};

const listLocationsOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}/locations",
  urlParameters: [
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion1
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.LocationListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const getOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions/{subscriptionId}",
  urlParameters: [
    Parameters.subscriptionId
  ],
  queryParameters: [
    Parameters.apiVersion1
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.Subscription
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "subscriptions",
  queryParameters: [
    Parameters.apiVersion1
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.SubscriptionListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};

const listNextOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  baseUrl: "https://management.azure.com",
  path: "{nextLink}",
  urlParameters: [
    Parameters.nextPageLink
  ],
  headerParameters: [
    Parameters.acceptLanguage
  ],
  responses: {
    200: {
      bodyMapper: Mappers.SubscriptionListResult
    },
    default: {
      bodyMapper: Mappers.CloudError
    }
  },
  serializer
};
