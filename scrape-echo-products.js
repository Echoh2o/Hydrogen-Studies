import * as cheerio from "cheerio";

const products = [
  "https://echowater.com/products/echo-flask",
  "https://echowater.com/products/hydrogen-prebiotic-stick-pack-30-pack",
  "https://echowater.com/products/echo-ultimate-hydrogen-water",
  "https://echowater.com/products/echo-refresh-hydrogen-inhalation-machine",
  "https://echowater.com/products/echo-revive",
];

async function scrapeProduct(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract product information
    const title =
      $("h1").first().text().trim() ||
      $(".product-title").first().text().trim() ||
      $("title").text().split("|")[0].trim();

    const price =
      $(".price").first().text().trim() ||
      $(".product-price").first().text().trim() ||
      $("[data-price]").first().text().trim() ||
      $(".money").first().text().trim();

    const description =
      $('meta[name="description"]').attr("content") ||
      $(".product-description").first().text().trim() ||
      $(".description").first().text().trim();

    const image = $("img")
      .filter((i, el) => {
        const src = $(el).attr("src");
        return src && (src.includes("product") || src.includes("cdn/shop"));
      })
      .first()
      .attr("src");

    const product = {
      url: url,
      title: title,
      price: price,
      description: description,
      image: image ? (image.startsWith("//") ? "https:" + image : image) : null,
    };

    return product;
  } catch (err) {
    throw err;
  }
}

(async () => {
  try {
    for (const url of products) {
      console.log("Scraping:", url);
      const product = await scrapeProduct(url);
      console.log(JSON.stringify(product, null, 2));
      console.log("---PRODUCT-SEPARATOR---");
      // Add delay to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
