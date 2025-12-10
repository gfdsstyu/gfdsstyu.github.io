/**
 * Script to add metadata wrapper to existing exam JSON
 * Usage: node addMetadata.js
 */

const fs = require('fs');
const path = require('path');

// Input: js/features/kam/2025.json (current flat structure)
// Output: js/features/exam/data/2025_kam_with_metadata.json

const inputPath = path.join(__dirname, '../../../kam/2025.json');
const outputPath = path.join(__dirname, '2025_kam_with_metadata.json');

// Read the existing data
const examCases = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Calculate statistics
let totalQuestions = 0;
let totalScore = 0;

examCases.forEach(examCase => {
  examCase.questions.forEach(question => {
    totalQuestions++;
    totalScore += question.score || 0;
  });
});

// Create the wrapped structure
const wrappedData = {
  metadata: {
    year: 2025,
    title: "공인회계사 2차 기출문제 (KAM 사례 기반)",
    description: "실제 감사보고서의 핵심감사사항(KAM)을 기반으로 한 실전 문제",
    duration: 5400, // 90 minutes in seconds
    totalQuestions: totalQuestions,
    totalScore: totalScore,
    passingScore: 60,
    schemaVersion: "1.0.0" // Current flat structure
  },
  exams: examCases
};

// Write the output
fs.writeFileSync(outputPath, JSON.stringify(wrappedData, null, 2), 'utf-8');

console.log('✅ Metadata added successfully!');
console.log(`   - Total cases: ${examCases.length}`);
console.log(`   - Total questions: ${totalQuestions}`);
console.log(`   - Total score: ${totalScore}`);
console.log(`   - Output: ${outputPath}`);
