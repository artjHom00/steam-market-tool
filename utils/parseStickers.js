/* 
this one is a crawlin' with puppeteer file, which i dont want you to see,
as it has a lot of interaction with their dom, it looks sloppy. 
but if you did - close it immediately :)
*/
let puppeteer = require("puppeteer");
const Sequelize = require("sequelize");
const sequelize = new Sequelize("steam", "root", "", {
  dialect: "mysql",
});

let a = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(
    "https://steamcommunity.com/market/search?appid=730&q=%D0%9D%D0%B0%D0%BA%D0%BB%D0%B5%D0%B9%D0%BA%D0%B0"
  );
  let pagesAmount = await page.evaluate(() => {
    return parseInt(
      document.querySelectorAll(".market_paging_pagelink")[
        document.querySelectorAll(".market_paging_pagelink").length - 1
      ].innerText
    );
  });
  console.log(pagesAmount);
  let stickers = {};
  for (let i = 173; i <= pagesAmount; i++) {
    const pageSteam = await browser.newPage();
    await pageSteam.goto(
      `https://steamcommunity.com/market/search?appid=730&q=%D0%9D%D0%B0%D0%BA%D0%BB%D0%B5%D0%B9%D0%BA%D0%B0#p${i}_name_asc`
    );
    await pageSteam.waitFor(30000);
    stickers[i] = await pageSteam.evaluate(() => {
      let object = {};
      const iterations = document.querySelectorAll(
        ".market_listing_row.market_recent_listing_row.market_listing_searchresult"
      ).length;
      for (let j = 0; j < iterations; j++) {
        object[
          document.querySelector(`#result_${j}_name`).innerText
        ] = document.querySelector(
          `#result_${j}`
        ).childNodes[3].childNodes[3].childNodes[1].childNodes[3].innerText;
      }
      return object;
    });
    await pageSteam.close();
    for (key in stickers[i]) {
      await sequelize.query(
        `INSERT INTO stickers(id, name, price) VALUES (default, "${key}", "${stickers[i][key]}")`
      );
    }
  }
  await browser.close();
};
a();
