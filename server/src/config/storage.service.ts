import { supabase } from "./supabase.config.js";
import { ApiError } from "../utils/ApiError.js";


class StorageService {


async uploadFile(
    bucket:string,
    path:string,
    buffer:Buffer,
    mimeType:string,
){

const {error}=await supabase.storage
.from(bucket)
.upload(
path,
buffer,
{
contentType:mimeType,
upsert:false,
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