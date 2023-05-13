// Importing required modules
require("dotenv").config(); // Loads environment variables from a .env file
const express = require("express");
const flash = require("connect-flash");
const session = require("express-session");
const port = process.env.port; // Retrieves the port from environment variables
const layouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const passport = require("passport");
const app = express();

// Configuring passport
require("./config/passport")(passport);

// Setting up view engine and layout
app.set("view engine", "ejs");
app.set("layout", "./layouts/main.ejs");

// Connecting to MongoDB
const db = process.env.MongoUri;
mongoose
  .connect(db, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.log(err));

// Middleware and static file serving
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(layouts);
app.use(express.static("public"));

// Setting up session middleware
app.use(
  session({
    secret: "secret", // Secret used to sign the session ID cookie
    resave: true,
    saveUninitialized: true,
  })
);

// Initializing passport and session middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages middleware
app.use(flash());

// Setting up locals for flash messages
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.setTimeError = req.flash("setTimeError");
  res.locals.setTimeSuccess = req.flash("setTimeSuccess");
  res.locals.createVotersError = req.flash("createVotersError");
  res.locals.createVotersSuccess = req.flash("createVotersSuccess");
  res.locals.votingSuccess_msg = req.flash("votingSuccess_msg");
  res.locals.cantVote = req.flash("cantVote");
  res.locals.noVoterFound = req.flash("noVoterFound");
  res.locals.votingError_msg = req.flash("votingError_msg");
  res.locals.createCandidateError1 = req.flash("createCandidateError1");
  res.locals.createCandidateError2 = req.flash("createCandidateError2");
  res.locals.createCandidateSuccess = req.flash("createCandidateSuccess");
  next();
});

// Routes
app.use("/", require("./server/adminRoutes"));
app.use("/", require("./server/voterRoutes"));
app.use("/", require("./server/electionRoutes"));

// Starting the server
app.listen(port, () => {
  console.log("running on port", port);
});
