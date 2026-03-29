const bcrypt = require("bcrypt");

(async () => {
    const password = "V3ry$ecureP4$$w0rd";
    const hash = await bcrypt.hash(password, 10);
    console.log(hash);
})();