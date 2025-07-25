var express = require("express");
var mysql = require("mysql2");
const path = require("path");
const fs = require("fs");
const fileupload = require("express-fileupload");
var cloudinary = require("cloudinary").v2;
const cors=require("cors");

var app = express();
app.use(fileupload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));  // for parsing form data
app.use(express.json());                          // for parsing JSON if needed
app.use(cors());


app.listen(2004, function () {
  console.log("✅ Server started at port: 2004");
});



// MySQL Aiven Connection Pool
const mySqlVen = mysql.createPool({
  host: "mysql-2fcb8c28-thapar-dd3a.c.aivencloud.com",
  port: 14165,
  user: "avnadmin",
  password: "AVNS_du-8iFKJIjOnhGczw93",
  database: "defaultdb",
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "certs", "ca.pem"))
  },
  connectionLimit: 10
});

// Cloudinary config
cloudinary.config({
  cloud_name: 'dstzxbqkc',
  api_key: '623432892855773',
  api_secret: '8lzf_wioX4HNhfxJE4IqZE1Gbl0',
});

// Home page
app.get("/", function (req, resp) {
  resp.sendFile(path.join(__dirname, "public", "home.html"));
});

// Signup
app.post("/server-signup", function (req, resp) {
  let { txtEmail, txtpwd, user } = req.body;

  mySqlVen.query(
    "INSERT INTO users25 (emailid, password, usertype, createdate, status) VALUES (?,?,?,?,?)",
    [txtEmail, txtpwd, user, new Date(), 1],
    function (err) {
      if (err)
        resp.send(" DB Error: " + err.message);
      else
        resp.send(" Record saved successfully.");
    }
  );
});

// Login
app.post("/login", function (req, res) {
  var emailid = req.body.emailid;
  var password = req.body.password;

  mySqlVen.query("SELECT * FROM users25 WHERE emailid=? AND password=?", [emailid, password], function (err, result) {
    if (err) {
      res.send({ success: false, message: "Database error" });
    } else if (result.length > 0) {
      // ✅ Found user
      let user = result[0];

      // 🔁 Redirect based on usertype
      if (user.usertype === "Organiser") {
        res.send({ success: true, redirect: "org-dash.html" });
      } else if (user.usertype === "Player") {
        res.send({ success: true, redirect: "play.html" });
      } else {
        res.send({ success: false, message: "Unknown user type." });
      }

    } else {
      // ❌ No matching user
      res.send({ success: false, message: "Invalid Email, Password, or User Type." });
    }
  });
});

// Save tournament details
app.post("/server-tour-safe", function (req, resp) {


  let { textEmail, texttitle, date, time, textadd, textcity, minage, maxage, lastdate, fee, money, textcont,textsport } = req.body;

  mySqlVen.query(
    "INSERT INTO tours225 (emailid, title, date, time, addr, city, minage, maxage, last, fee, money, contact,sport) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [textEmail, texttitle, date, time, textadd, textcity, minage, maxage, lastdate, fee, money, textcont,textsport],
    function (errsm) {
      if (errsm)
        resp.send("Error: " + errsm.message);
      else
        resp.send("Tournament details saved successfully.");
    }
  );
});
app.get("/do-fetch-all-tours", function(req, resp) {
    mySqlVen.query("SELECT * FROM tours225", function(err, allRecords) {
        if (err) {
            resp.status(500).send(err);
        } else if (allRecords.length === 0) {
            resp.send("No record found");
        } else {
            resp.json(allRecords);
        }
    });
});

// Save player details
app.post("/server-play-details-safe", function (req, resp) {
  // Step 1: Validate if files are coming
  if (!req.files || !req.files.adhaar || !req.files.profilePic) {
    return resp.status(400).send(" Please upload both Adhaar and Certificate files.");
  }

  // Step 2: Get text fields
  let { textEmail, textadd, textsport, textcont, textinfo } = req.body;

  // Step 3: Get file objects
  let adhaarFile = req.files.adhaar;
  let profilePicFile = req.files.profilePic;

  // Step 4: Upload both files to Cloudinary
  cloudinary.uploader.upload(adhaarFile.tempFilePath, { folder: "players" }, function (err1, result1) {
    if (err1) return resp.send(" Cloudinary Error (Adhaar): " + err1.message);

    cloudinary.uploader.upload(profilePicFile.tempFilePath, { folder: "players" }, function (err2, result2) {
      if (err2) return resp.send(" Cloudinary Error (Certificate): " + err2.message);

      let adhaarURL = result1.secure_url;
      let profileURL = result2.secure_url;

      // Step 5: Save in MySQL
      mySqlVen.query(
        "INSERT INTO play225 (emailid, adhaar, pic, addr, sport, contact, info) VALUES (?,?,?,?,?,?,?)",
        [textEmail, adhaarURL, profileURL, textadd, textsport, textcont, textinfo],
        function (errsm) {
          if (errsm)
            resp.send(" DB Error: " + errsm.message);
          else
            resp.send(" Player details saved successfully.");
        }
      );
    });
  });
});


//user details fetching
app.get("/do-fetch-all-users", function(req, resp) {
  mySqlVen.query(
    `SELECT u.emailid, u.usertype
     FROM users25 u 
     LEFT JOIN users2025 o 
     ON u.emailid = o.emailid`,
    function(err, allRecords) {
      if (err) {
        resp.status(500).send(err);
      } else if (allRecords.length === 0) {
        resp.send("No record found");
      } else {
        resp.json(allRecords);
      }
    }
  );
});


//fecthing tournamnet details
app.get("/fetch-filtered-tournaments", function(req, resp) {
    let sport = req.query.sport || "";
    let city = req.query.city || "";
  let age = parseInt(req.query.age) || 0;


    let query = "SELECT * FROM tours225 WHERE 1=1 ";
    let param = [];

    if (sport) {
        query += " AND sport LIKE ? ";
        param.push("%" + sport + "%");
    }

    if (city) {
        query += " AND city LIKE ? ";
        param.push("%" + city + "%");
    }

   if (age > 0) {
    query += " AND CAST(minage AS UNSIGNED) <= ? AND CAST(maxage AS UNSIGNED) >= ? ";
    param.push(age, age);
  }


    mySqlVen.query(query, param, function(err, result) {
        if (err) {
            console.log(err);
            resp.status(500).send("Database Error");
        } else {
            resp.json(result);
        }
    });
});


//update password
app.get("/update-password", function (req, resp) {
  var email = req.query.emailid;
  var oldpwd = req.query.oldpwd;
  var newpwd = req.query.newpwd;

  mySqlVen.query(
    "UPDATE users25 SET pwd = ? WHERE emailid = ? AND pwd = ?",
    [newpwd, email, oldpwd],
    function (errsm, result) {
      if (errsm) {
        resp.send("DB Error: " + errsm.message);
      } else {
        if (result.affectedRows > 0)
          resp.send(" Password changed successfully.");
        else
          resp.send("Invalid Email ID or Old Password.");
      }
    }
  );
});
