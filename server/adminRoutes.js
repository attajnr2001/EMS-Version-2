const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const Voter = require("../models/Voter");
const Candidate = require("../models/Candidate");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const csv = require("csv-parser");
const multer = require("multer");
const upload = multer({ dest: "public/uploads/" });
const passport = require("passport");
const { ensureAuthenticated } = require("../config/auth");
const axios = require("axios");
const imageMimeTypes = ["image/jpeg", "image/png", "image/gif"];

// Welcome page route
router.get("/", (req, res) => {
  res.render("welcome", { title: "Welcome EMS" });
});

// Admin login route
router.post("/admin/login", async (req, res, next) => {
  const loginErrors = [];
  try {
    const { userName, password } = req.body;

    // Finding admin by username in the database
    admin = await Admin.findOne({ userName: userName });

    // Authenticating admin using passport
    passport.authenticate("admin-local", {
      successRedirect: `/admin/dashboard/${admin._id}`,
      failureRedirect: `/admin/login`,
      failureFlash: true,
    })(req, res, next);
  } catch (error) {
    console.log(error);
    loginErrors.push({ loginErrorMsg: "Can't find User" });

    // Rendering login page with error message
    res.render("admin/login", {
      title: "EMS Login",
      loginErrors: loginErrors,
    });
  }
});

router.post(
  "/admin/dashboard/:_id/uploadVoters",
  upload.single("csv-file"),
  async (req, res) => {
    const id = req.params._id;

    // Finding admin by id in the database
    const admin = await Admin.findOne({ _id: id });

    const file = req.file;
    console.log(file);
    const results = [];
    try {
      // Reading and processing the uploaded CSV file
      fs.createReadStream("./public/uploads/" + file.filename)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          console.log(results);

          // Creating an array of voters to save in the database
          const votersToSave = results.map((data) => ({
            INDEX: data.INDEX,
            password: data.password,
            department: admin.department,
          }));
          console.log(votersToSave);

          // Inserting the voters into the database
          await Voter.insertMany(votersToSave);
          console.log("Voters saved to database");

          // Deleting the uploaded CSV file
          fs.unlinkSync("./public/uploads/" + file.filename);
          console.log("CSV file deleted");
        });

      req.flash("createVotersSuccess", "Voters added successfully");
      res.redirect(`/admin/dashboard/${id}`);
    } catch (error) {
      console.log(error);
      req.flash("createVotersError", "Something went wrong. Please try again.");
      res.redirect(`/admin/dashboard/${id}`);
    }
  }
);

router.get("/admin/login", (req, res) => {
  res.render("admin/login", { title: "Admin login page" });
});

router.get("/admin/dashboard/:_id", ensureAuthenticated, async (req, res) => {
  const admin = await Admin.findOne({ _id: req.params._id });

  // Finding another admin with the role "supervisor" in the same department
  const _admin = await Admin.findOne({
    role: "supervisor",
    department: admin.department,
  });

  res.render("admin/dashboard", {
    title: "Kam 3 dashboard",
    admin: admin,
    _admin: _admin,
  });
});

router.get("/logout", (req, res) => {
  // Logging out the user
  req.logout((err) => {
    if (err) throw err;
  });

  // Redirecting to the admin login page
  res.redirect("/admin/login");
});

router.post("/admin/dashboard/:_id", ensureAuthenticated, async (req, res) => {
  const id = req.params._id;

  // Finding admin by id in the database
  const admin = await Admin.findOne({ _id: id });
  console.log(admin.role);

  const setTime = req.body.electionDate;
  const ElectionEndDate = req.body.ElectionEndDate;

  try {
    if (admin.role == "supervisor") {
      // Updating the ElectionEndDate and setTime for the supervisor admin
      const result = await Admin.updateOne(
        { _id: id, department: admin.department },
        { $set: { ElectionEndDate: ElectionEndDate } }
      );
      const result2 = await Admin.updateOne(
        { _id: id, department: admin.department },
        { $set: { setTime: setTime } }
      );

      req.flash("setTimeSuccess", "Date has been changed");
      res.redirect("/admin/dashboard/" + id);
    } else {
      req.flash("setTimeError", "Sorry, you cannot set the date");
      res.redirect("/admin/dashboard/" + id);
    }
  } catch (error) {
    console.log(error);
  }
});

router.post(
  "/admin/dashboard/:_id/deleteVoters",
  ensureAuthenticated,
  async (req, res) => {
    const id = req.params._id;

    // Finding admin by id in the database
    const admin = await Admin.findOne({ _id: id });

    try {
      if (admin.role == "supervisor") {
        // Deleting all candidates and voters from the database
        await Candidate.deleteMany({});
        await Voter.deleteMany({});

        res.redirect(`/admin/dashboard/${id}`);
      } else {
        res.json("Cannot delete voters");
      }
    } catch (error) {
      console.log(error);
    }
  }
);

router.get(
  "/admin/dashboard/:_id/addCandidate",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const id = req.params._id;

      // Finding all candidates in the database
      const candidate = await Candidate.find({});

      // Finding admin by id in the database
      const admin = await Admin.findOne({ _id: id });

      // Finding all voters in the same department as the admin
      const voters = await Voter.find({ department: admin.department });

      res.render("admin/newCandidate", {
        title: "Node App Add Candidate",
        admin: admin,
        candidate: candidate,
        voters: voters,
      });
    } catch (error) {
      console.log(error);
    }
  }
);

router.post(
  "/admin/dashboard/:_id/addCandidate",
  ensureAuthenticated,
  async (req, res) => {
    const id = req.params._id;

    try {
      // Creating a new candidate instance with the provided data
      const candidate = new Candidate({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        voter: req.body.voter,
        position: req.body.position,
        department: req.body.department,
      });

      // Saving the cover image associated with the candidate
      saveCover(candidate, req.body.cover);

      try {
        // Saving the new candidate to the database
        const newCandidate = await candidate.save();

        req.flash(
          "createCandidateSuccess",
          "Candidate registration successful"
        );
        res.redirect(`/admin/dashboard/${id}/addCandidate`);
      } catch (err) {
        req.flash("createCandidateError2", "Something went wrong");
        res.redirect(`/admin/dashboard/${id}/addCandidate`);
      }
    } catch (error) {
      req.flash(
        "createCandidateError1",
        "Sorry, the candidate is already registered"
      );
      res.redirect(`/admin/dashboard/${id}/addCandidate`);
    }
  }
);

router.get(
  "/admin/dashboard/:_id/viewCandidate",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const id = req.params._id;

      // Finding admin by id in the database
      const admin = await Admin.findOne({ _id: id });

      // Finding candidates for the position of president in the same department as the admin
      const president = await Candidate.find({
        position: "president",
        department: admin.department,
      });

      // Finding candidates for the position of secretary in the same department as the admin
      const secretary = await Candidate.find({
        position: "secretary",
        department: admin.department,
      });

      res.render("admin/viewCandidate", {
        title: "Node App View Candidate",
        admin: admin,
        president: president,
        secretary: secretary,
      });
    } catch (error) {
      console.log(error);
    }
  }
);

router.get(
  "/admin/dashboard/:_id/addAdmin",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const id = req.params._id;

      // Finding admin by id in the database
      const admin = await Admin.findOne({ _id: id });

      res.render("admin/addAdmin", {
        title: "Node App View Election",
        admin: admin,
      });
    } catch (error) {
      console.log(error);
    }
  }
);

router.post(
  "/admin/dashboard/:_id/addAdmin",
  ensureAuthenticated,
  async (req, res) => {
    const id = req.params._id;

    // Finding admin by id in the database
    const admin = Admin.findOne({ _id: id });

    // Initializing an empty array to store errors
    const errors = [];

    try {
      // Destructuring the request body to extract form data
      const {
        firstName,
        lastName,
        userName,
        password,
        password2,
        department,
        phone,
        role,
        dob,
      } = req.body;

      if (password != password2) {
        errors.push({ msg: "Passwords do not match" });
      }

      if (errors.length > 0) {
        // Render the addAdmin page with the provided form data and errors
        res.render(`admin/addAdmin`, {
          title: "Node Js App",
          errors,
          firstName,
          lastName,
          userName,
          password,
          password2,
          department,
          phone,
          role,
          dob,
        });
      } else {
        Admin.findOne({ userName: userName }).then(async (admin) => {
          if (admin) {
            errors.push({ msg: "Username is not available" });
            // Render the addAdmin page with the provided form data, errors, and username availability message
            res.render(`admin/addAdmin`, {
              title: "Node Js App",
              errors,
              firstName,
              lastName,
              userName,
              password,
              password2,
              department,
              phone,
              role,
              dob,
            });
          } else {
            // Hash the password using bcrypt
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create a new admin instance with the provided form data
            const admin = new Admin({
              firstName,
              lastName,
              userName,
              password: hashedPassword,
              department,
              phone,
              dob,
              role,
            });

            try {
              // Save the new admin to the database
              await admin.save();
              res.redirect("/admin/dashboard/" + id);
            } catch (err) {
              console.error(err);
            }
          }
        });
      }
    } catch (error) {
      console.log(error);
    }
  }
);

router.post(
  "/admin/dashboard/:_id/removeAll",
  ensureAuthenticated,
  async (req, res) => {
    const id = req.params._id;

    // Finding admin by id in the database
    const admin = Admin.findOne({ _id: id });

    try {
      // Define an async function to delete all candidates
      async function deleteAll() {
        try {
          // Delete all documents in the "Candidate" collection
          const result = await Candidate.deleteMany({});
          console.log(`${result.deletedCount} documents deleted`);
          res.redirect("/admin/dashboard/" + id);
        } catch (error) {
          console.error(error);
        }
      }

      // Call the deleteAll function
      deleteAll();
    } catch (error) {
      console.log(error);
    }
  }
);

function saveCover(book, coverEncoded) {
  // Check if cover image is not provided
  if (coverEncoded == null) return;

  // Parse the cover image data from base64 string to object
  const cover = JSON.parse(coverEncoded);

  // Check if the cover image is not null and its type is included in the allowed image mime types
  if (cover != null && imageMimeTypes.includes(cover.type)) {
    // Set the book's cover image to a Buffer of the image data in base64 format
    book.coverImage = Buffer.from(cover.data, "base64");
    // Set the book's cover image type to the detected image type
    book.coverImageType = cover.type;
  }
}

// createAdmin(
//   "Atta",
//   "Senior",
//   "attasnr",
//   "111111",
//   "ict",
//   "2022-01-01",
//   "2023-01-01",
//   "0201610861",
//   "supervisor",
//   "1990-03-02"
// );

async function createAdmin(
  firstName,
  lastName,
  userName,
  password,
  department,
  setTime,
  ElectionEndDate,
  phone,
  role,
  dob
) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = new Admin({
    firstName: firstName,
    lastName: lastName,
    userName: userName,
    password: hashedPassword,
    department: department,
    setTime: setTime,
    ElectionEndDate: ElectionEndDate,
    phone: phone,
    role: role,
    dob: dob,
  });

  try {
    await admin.save();
    console.log("Admin user created successfully");
  } catch (err) {
    console.error(err);
  }
}

async function printAllVoters() {
  try {
    const voters = await Voter.find();
    voters.forEach((voter) => {
      console.log(voter);
    });
    console.log(`Total voters: ${voters.length}`);
  } catch (error) {
    console.error(error);
  }
}

// Call the function to print all voters
// printAllVoters();

module.exports = router;
