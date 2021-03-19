module.exports = function(socket, page, browser) {
  socket.on("authorize in steam", async (data) => {
    // authorizing to steam and restoring all existing filter (code might be a lil bit sloppy because of attracting with DOM)
    await page.type("#input_username", data.steamLogin); // type user's login
    await page.type("#input_password", data.steamPassword); // type user's password
    await page.click(".btn_blue_steamui.btn_medium.login_btn");
    await page
      .waitForSelector(".newmodal") // event: on steam guard's modal window open
      .then(async () => {
        await page.type("#twofactorcode_entry", data.steamGuard); // type steam guard code
        await page.click(
          "#login_twofactorauth_buttonset_entercode > div.auth_button.leftbtn"
        ); // clicks verifying button
        await page
          .waitForSelector(".profile_header") // event: on profile's page username popup
          .then(() => {
            socket.emit("successfully authorized");
            global.flags["authorized"] = true;
          })
          .catch(() => {
            socket.emit("failed to authorize");
          });
      })
      .catch(async () => {
        // if we get an error while authorizing - emitting it and reloading the page => input fields are getting empty
        await page.waitForSelector("#error_display").then(async () => {
          await page.reload();
          socket.emit("failed to authorize");
        });
      });
  });
}