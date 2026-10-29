import { supabase } from "./supabase.config.js";
import { ApiError } from "../utils/ApiError.js";


/**
 * Supabase Storage rejects object keys with spaces, brackets, '#', non-Latin
 * letters and the like ("Invalid key"), which is exactly what a photo named
 * "WhatsApp Image (1).jpeg" or a Gujarati file name contains. Every segment of
 * the key is reduced to letters, digits, dot, dash and underscore.
 */
function safeKey(path: string): string {
  return path
    .split("/")
    .map((segment) => segment.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file")
    .join("/");
}

class StorageService {


async uploadFile(
    bucket:string,
    rawPath:string,
    buffer:Buffer,
    mimeType:string,
){

const path=safeKey(rawPath);

const {error}=await supabase.storage
.from(bucket)
.upload(
path,
buffer,
{
contentType:mimeType,
upsert:false,
// Every upload goes to a path that starts with a timestamp, so a given
// address always means the same picture and a replaced picture gets a NEW
// address. That makes it safe to let browsers keep the file for a year;
// without this Supabase answers "no-cache" and every visit re-asks for
// every picture on the page.
cacheControl:"31536000",
}
);


if(error){

throw new ApiError(
500,
error.message
);

}


const {data}=supabase.storage
.from(bucket)
.getPublicUrl(path);


return data.publicUrl;

}



async deleteFile(
bucket:string,
path:string
){


const {error}=await supabase.storage
.from(bucket)
.remove([
path
]);


if(error){

throw error;

}


}



async deleteFileSafe(
bucket:string,
path:string
){

try{

await this.deleteFile(
bucket,
path
);

}
catch(error){

console.error(
"Storage cleanup failed",
error
);

}

}



extractPathFromUrl(
url:string,
bucket:string
){

const parts =
url.split(
`${bucket}/`
);


return parts[1] ?? null;

}


}



export const storageService =
new StorageService();