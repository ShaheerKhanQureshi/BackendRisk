
  // src/controllers/assessmentController.js

  const Assessment = require("../models/Assessment"); // Keeping this for tracking assessments
  const logger = require("../utils/logger");
  const db = require("../config/db"); // Database connection
  
  const submitAssessment = async (req, res) => {
    const { slug } = req.params;
    const { employee_info, health_assessment } = req.body;
  
    if (!slug || !employee_info || !health_assessment) {
      return res.status(400).json({ message: "Missing required fields." });
    }
  
    try {
      const query = `INSERT INTO \`assessment_response\` (company_slug, employee_info, health_assessment) VALUES (?, ?, ?)`;
      const [result] = await db.query(query, [slug, employee_info, health_assessment]);
  
      const assessment_id = result.insertId; // Assuming insertId is returned by the query
      res.status(200).json({ message: "Success", assessment_id });
    } catch (err) {
      console.error("Database insertion error:", err);
      res.status(500).json({ message: "Error while entering form", error: err.message });
    }
  };
  
  const submitForm = async (req, res) => {
    try {
      const { answers, userId, companyId, bmi = 0 } = req.body;
  
      if (!answers || !userId || !companyId) {
        return res.status(400).json({ error: "Answers, User ID, and Company ID are required" });
      }
  
      // Initialize section scores
      const sectionScores = {
        "Personal Health Habits": 0,
        "Personal Medical History": 0,
        "Women Health": 0,
        "Lifestyle and Diet": 0,
        "Mental and Emotional Well Being": 0,
        "Occupational Health": 0,
        "Burnout and Stress at Work": 0,
      };
  
      // Define the category thresholds for each section
      const sectionCategories = {
        "Personal Health Habits": [
          { range: [0, 10], category: "Healthy Habits" },
          { range: [11, 20], category: "Good Habits" },
          { range: [21, 30], category: "Moderately Healthy Habits" },
          { range: [31, 40], category: "Risky Habits (High Risk)" },
          { range: [41, 50], category: "Unhealthy Habits" },
        ],
        "Personal Medical History": [
          { range: [0, 30], category: "Healthy Records" },
          { range: [31, 60], category: "Mild Risk" },
          { range: [61, 90], category: "Moderate Risk" },
          { range: [91, 120], category: "Elevated Risk" },
          { range: [121, 156], category: "High Risk" },
        ],
        "Women Health": [
          { range: [0, 10], category: "Optimal Health" },
          { range: [11, 20], category: "Moderate Risk" },
          { range: [21, 23], category: "High Risk" },
        ],
        "Lifestyle and Diet": [
          { range: [0, 10], category: "Health Lifestyle and Diet" },
          { range: [11, 20], category: "Balanced lifestyle and Diet Risk" },
          { range: [21, 31], category: "Unhealthy Lifestyle and Diet" },
        ],
        "Mental and Emotional Well Being": [
          { range: [0, 8], category: "Mental Fortitude" },
          { range: [9, 16], category: "Stable but sensitive" },
          { range: [17, 24], category: "Vulnerable to Stress" },
          { range: [25, 32], category: "Mental Health at Risk" },
          { range: [33, 40], category: "Critical Mental Health concern" },
        ],
        "Occupational Health": [
          { range: [0, 20], category: "Optimal Work Life Balance" },
          { range: [21, 40], category: "Generally Good Health" },
          { range: [41, 60], category: "Moderate Risk" },
          { range: [61, 80], category: "High Risk of Occupational Strain" },
          { range: [81, 100], category: "Critical Occupational Health Concern" },
        ],
        "Burnout and Stress at Work": [
          { range: [0, 20], category: "Low Risk of Burnout" },
          { range: [21, 40], category: "Moderate Risk of Burnout" },
          { range: [41, 60], category: "Noticeable Risk of Burnout" },
          { range: [61, 80], category: "High risk Of Burnout" },
          { range: [81, 100], category: "Severe Burnout" },
        ],
      };
  
      // Process each answer, find corresponding question, and save it
      const answerRecords = [];
  
      // Loop through answers to calculate section-wise scores
      for (const answerData of answers) {
        const { questionId, response, section } = answerData;
        const question = await Question.findById(questionId);
  
        if (!question) {
          return res.status(400).json({ error: "Question not found" });
        }
  
        // Create the answer record and save it
        const answer = new Answer({
          user: userId,
          question: questionId,
          response,
        });
        await answer.save();
        answerRecords.push(answer);
  
        // Get the score based on the response option selected
        const scoring = question.options.find((option) => option.answer === response)?.marks || 0;
  
        // Add the score to the relevant section
        sectionScores[section] += scoring;
      }
  
      // Function to get section category based on score
      const getCategory = (section, score) => {
        const categoryRange = sectionCategories[section];
        const category = categoryRange.find(
          (range) => score >= range.range[0] && score <= range.range[1]
        );
        return category ? category.category : "Unknown";
      };
  
      // Generate report with sections and categories
      const sectionsWithCategories = {};
      let totalScore = 0;
  
      // Calculate total score and get the category for each section
      for (const [section, score] of Object.entries(sectionScores)) {
        totalScore += score; // Aggregate the total score
        sectionsWithCategories[section] = {
          score,
          category: getCategory(section, score),
        };
      }
  
      // Create the final report data
      const newReport = {
        Assessment_Id,
        companyId,
        healthRiskScore: totalScore,
        sections: sectionsWithCategories,
        bmi,
      };
  
      // Save the report in the database
      const report = await Report.create(newReport);
  
      // Save the assessment data (linking answers to the report)
      const assessmentData = new Assessment({
        Assessment_Id,
        companyId,
        answers: answerRecords.map((a) => a._id), // Save references to the answers
        reportId: report._id, // Link to the created report
      });
      await assessmentData.save();
  
      // Optionally, send an email to the user
      await sendEmailToUser(req.user.email, report);
  
      // Return response with the report
      res.status(201).json({ message: "Assessment submitted successfully", report });
    } catch (error) {
      logger.error("Error submitting assessment:", error);
      res.status(500).json({ error: "Error submitting assessment: " + error.message });
    }
  };
  
  
  // View responses for the logged-in user
  const viewResponses = async (req, res) => {
    try {
      const responses = await Answer.find({ user: req.user.id }).populate(
        "question"
      );
      res.status(200).json(responses);
    } catch (err) {
      logger.error("Error fetching responses:", err);
      res
        .status(500)
        .json({ error: "An error occurred while fetching responses" });
    }
  };
  
  // Download forms as PDF
  const downloadForm = async (req, res) => {
    const { Assessment_Id } = req.params;
    try {
      const responses = await Answer.find({ user: Assessment_Id }).populate("question");
      const pdfBuffer = await createPdfFromResponses(responses);
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename=form-${Assessment_Id}.pdf`);
      res.send(pdfBuffer);
    } catch (err) {
      logger.error("Error downloading form:", err);
      res
        .status(500)
        .json({ error: "An error occurred while downloading the form" });
    }
  };
  
  // Generate report functionality
  const generateReport = async (req, res) => {
    const { Assessment_Id } = req.params;
  
    try {
      const report = await Report.findOne({ user: Assessment_Id }).populate("answers");
      if (!report) return res.status(404).json({ error: "Report not found" });
  
      const pdfBuffer = await createPdfFromReport(report);
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename=report-${Assessment_Id}.pdf`);
      res.send(pdfBuffer);
    } catch (err) {
      logger.error("Error generating report:", err);
      res
        .status(500)
        .json({ error: "An error occurred while generating the report" });
    }
  };
  
 
  
  module.exports = {
    submitAssessment,
    submitForm,
    viewResponses,
    downloadForm,
    generateReport,
  };
  
