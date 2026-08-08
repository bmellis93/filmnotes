// lib/r2Signed.ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";

export async function signR2GetUrl(
  key: string,
  expiresInSeconds: number,
  downloadFilename?: string
) {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(
            /["\\]/g,
            ""
          )}"`,
        }
      : {}),
  });

  return getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });
}