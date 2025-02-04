/*
 Setup: Enter your storage account name and shared key in main()
*/

import { FileServiceClient, SharedKeyCredential } from "../../src"; // Change to "@azure/storage-file-share" in your package

async function main() {
  // Enter your storage account name and shared key
  const account = process.env.ACCOUNT_NAME || "";
  const accountKey = process.env.ACCOUNT_KEY || "";

  // Use SharedKeyCredential with storage account and account key
  // SharedKeyCredential is only avaiable in Node.js runtime, not in browsers
  const sharedKeyCredential = new SharedKeyCredential(account, accountKey);

  const serviceClient = new FileServiceClient(
    `https://${account}.file.core.windows.net`,
    sharedKeyCredential
  );

  console.log(`List shares`);

  // 1. List shares
  let i = 1;
  let iter = serviceClient.listShares();
  for await (const share of iter) {
    console.log(`Share ${i++}: ${share.name}`);
  }

  // 2. Same as the previous example
  i = 1;
  for await (const share of serviceClient.listShares()) {
    console.log(`Share ${i++}: ${share.name}`);
  }

  // 3. Generator syntax .next()
  i = 1;
  iter = await serviceClient.listShares();
  let shareItem = await iter.next();
  while (!shareItem.done) {
    console.log(`Share ${i++}: ${shareItem.value.name}`);
    shareItem = await iter.next();
  }

  ////////////////////////////////////////////////////////
  ///////////////  Examples for .byPage()  ///////////////
  ////////////////////////////////////////////////////////

  // 4. list shares by page
  i = 1;
  for await (const response of serviceClient.listShares().byPage()) {
    if (response.shareItems) {
      for (const share of response.shareItems) {
        console.log(`Share ${i++}: ${share.name}`);
      }
    }
  }

  // 5. Same as the previous example - passing maxPageSize in the page settings
  i = 1;
  for await (const response of serviceClient.listShares().byPage({ maxPageSize: 20 })) {
    if (response.shareItems) {
      for (const share of response.shareItems) {
        console.log(`Share ${i++}: ${share.name}`);
      }
    }
  }

  // 6. Generator syntax .next()
  i = 1;
  let iterator = serviceClient.listShares().byPage({ maxPageSize: 2 });
  let response = await iterator.next();
  while (!response.done) {
    if (response.value.shareItems) {
      for (const share of response.value.shareItems) {
        console.log(`Share ${i++}: ${share.name}`);
      }
    }
    response = await iterator.next();
  }

  // 7. Passing marker as an argument (similar to the previous example)
  i = 1;
  iterator = serviceClient.listShares().byPage({ maxPageSize: 2 });
  response = await iterator.next();
  // Prints 2 share names
  if (response.value.shareItems) {
    for (const share of response.value.shareItems) {
      console.log(`Share ${i++}: ${share.name}`);
    }
  }
  // Gets next marker
  let marker = response.value.continuationToken;
  // Passing next marker as continuationToken
  iterator = serviceClient.listShares().byPage({ continuationToken: marker, maxPageSize: 10 });
  response = await iterator.next();
  // Prints 10 share names
  if (response.value.shareItems) {
    for (const share of response.value.shareItems) {
      console.log(`Share ${i++}: ${share.name}`);
    }
  }
}

// An async method returns a Promise object, which is compatible with then().catch() coding style.
main()
  .then(() => {
    console.log("Successfully executed sample.");
  })
  .catch((err) => {
    console.log(err.message);
  });
