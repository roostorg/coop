import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function s3StoreObjectFactory(region: string, bucketName: string) {
  const client = new S3Client({ region });

  return async function (objectKey: string, content: Uint8Array) {
    // No return value for now, since we don't want to expand the contract too
    // much/prematurely. callers just need to know if it succeeded or not, which
    // they can get from whether the promise resolves or rejects.
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: content,
      }),
    );
  };
}

export default s3StoreObjectFactory;
export type S3StoreObjectFactory = typeof s3StoreObjectFactory;
export type S3StoreObject = ReturnType<S3StoreObjectFactory>;
