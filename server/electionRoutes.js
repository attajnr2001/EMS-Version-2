const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const Voter = require("../models/Voter");
const Candidate = require("../models/Candidate");
const { ensureAuthenticated } = require("../config/auth");

// Route to display election statistics
router.get("/election/stats/:_id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params._id;
    let votersCount, voted, notVoted;
    const admin = await Admin.findOne({ _id: id });
    const voter = await Voter.findOne({ _id: id });

    // Check if the current user is an admin or voter
    if (voter == null) {
      // If admin, fetch statistics for the entire department
      votersCount = await Voter.countDocuments({
        department: admin.department,
      });
      voted = await Voter.countDocuments({
        Voted: true,
        department: admin.department,
      });
      notVoted = await Voter.countDocuments({
        Voted: false,
        department: admin.department,
      });
    } else {
      // If voter, fetch statistics for their own department
      votersCount = await Voter.countDocuments({
        department: voter.department,
      });
      voted = await Voter.countDocuments({
        Voted: true,
        department: voter.department,
      });
      notVoted = await Voter.countDocuments({
        Voted: false,
        department: voter.department,
      });
    }

    const voters = { votersCount, voted, notVoted };
    res.render("election/stats", {
      title: "Node App View Election",
      admin: admin,
      voter: voter,
      voters: voters,
    });
  } catch (error) {
    console.log(error);
  }
});

// Route to display election results
router.get("/election/results/:_id", ensureAuthenticated, async (req, res) => {
  try {
    const id = req.params._id;
    let president, secretary, candidates;

    let admin = await Admin.findOne({ _id: id });
    let voter = await Voter.findOne({ _id: id });

    // Check if the current user is an admin or voter
    if (voter == null) {
      // If admin, fetch candidates for the entire department
      president = await Candidate.find({
        position: "president",
        department: admin.department,
      });
      secretary = await Candidate.find({
        position: "secretary",
        department: admin.department,
      });
    } else {
      // If voter, fetch candidates for their own department and supervisor information
      president = await Candidate.find({
        position: "president",
        department: voter.department,
      });
      secretary = await Candidate.find({
        position: "secretary",
        department: voter.department,
      });
      admin = await Admin.findOne({
        department: voter.department,
        role: "supervisor",
      });
    }

    candidates = { president, secretary };

    res.render("election/results", {
      title: "Node App View Election",
      admin: admin,
      voter: voter,
      candidates: candidates,
    });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
