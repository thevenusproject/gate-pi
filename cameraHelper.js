import Path from "path"
import fs from "fs"
import axios from "axios"

export async function downloadImage({ url, imageType = '' }) {
  // const path = `${__dirname}/photos/${Date.now()}.jpg`;
  const imagePath = Path.resolve(
    __dirname,
    "photos",
    `${imageType}${Date.now()}.jpg`
  );
  const writer = fs.createWriteStream(imagePath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", (res) => {
      resolve(imagePath);
    });
    writer.on("error", reject);
  });
}

export async function deleteImage(imagePath) {
  fs.unlinkSync(imagePath);
}
