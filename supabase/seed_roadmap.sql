-- ============================================================================
-- Seed: default learning roadmap (English + Math, grades 1–8)
-- Safe to re-run: clears existing roadmap rows first.
-- ============================================================================

delete from learning_roadmap;

-- Helper pattern: (grade, subject, topic, order_index)
insert into learning_roadmap (grade, subject, topic, description, order_index) values
-- Grade 1
(1, 'english', 'Alphabet Recognition', 'Identify and name all 26 letters, upper and lower case.', 1),
(1, 'english', 'Phonics & Letter Sounds', 'Match letters to their sounds.', 2),
(1, 'english', 'Simple Words', 'Blend sounds into 2-3 letter words (cat, dog, sun).', 3),
(1, 'english', 'Sight Words', 'Recognize common high-frequency words on sight.', 4),
(1, 'english', 'Short Sentences', 'Read and construct 3-5 word sentences.', 5),
(1, 'math', 'Counting 1-20', 'Count objects and recognize numerals 1 through 20.', 1),
(1, 'math', 'Number Recognition', 'Read and write numerals up to 50.', 2),
(1, 'math', 'Basic Addition', 'Add numbers within 10 using objects/fingers.', 3),
(1, 'math', 'Basic Subtraction', 'Subtract numbers within 10.', 4),
(1, 'math', 'Shapes & Patterns', 'Identify basic shapes and simple repeating patterns.', 5),

-- Grade 2
(2, 'english', 'Words', 'Build vocabulary of common 3-5 letter words.', 1),
(2, 'english', 'Sentences', 'Form grammatically simple sentences with subject + verb.', 2),
(2, 'english', 'Punctuation Basics', 'Use capital letters and full stops correctly.', 3),
(2, 'english', 'Short Paragraphs', 'Read and write 3-4 sentence paragraphs.', 4),
(2, 'english', 'Story Sequencing', 'Retell a short story in the correct order.', 5),
(2, 'math', 'Addition within 100', 'Two-digit addition without carrying.', 1),
(2, 'math', 'Subtraction within 100', 'Two-digit subtraction without borrowing.', 2),
(2, 'math', 'Carrying & Borrowing', 'Two-digit addition/subtraction with regrouping.', 3),
(2, 'math', 'Introduction to Multiplication', 'Understand multiplication as repeated addition.', 4),
(2, 'math', 'Money & Measurement', 'Basic currency counting and length/weight units.', 5),

-- Grade 3
(3, 'english', 'Paragraphs', 'Write structured paragraphs with a clear topic sentence.', 1),
(3, 'english', 'Grammar: Tenses', 'Use past, present, and future tense correctly.', 2),
(3, 'english', 'Comprehension', 'Answer questions about a short passage.', 3),
(3, 'english', 'Creative Writing', 'Write a short story (5-8 sentences).', 4),
(3, 'english', 'Stories', 'Read grade-level story books independently.', 5),
(3, 'math', 'Multiplication Tables (2-5)', 'Memorize and apply tables 2 through 5.', 1),
(3, 'math', 'Multiplication Tables (6-10)', 'Memorize and apply tables 6 through 10.', 2),
(3, 'math', 'Division Basics', 'Understand division as equal sharing.', 3),
(3, 'math', 'Long Division', 'Divide 2-digit numbers by 1-digit numbers.', 4),
(3, 'math', 'Introduction to Fractions', 'Identify halves, thirds, and quarters.', 5),

-- Grade 4
(4, 'english', 'Advanced Grammar', 'Adjectives, adverbs, and conjunctions in context.', 1),
(4, 'english', 'Reading Comprehension', 'Infer meaning and summarize longer passages.', 2),
(4, 'english', 'Essay Writing', 'Write a structured 3-paragraph essay.', 3),
(4, 'english', 'Vocabulary Building', 'Use synonyms/antonyms and context clues.', 4),
(4, 'math', 'Fractions', 'Add and subtract fractions with like denominators.', 1),
(4, 'math', 'Equivalent Fractions', 'Identify and generate equivalent fractions.', 2),
(4, 'math', 'Decimals Introduction', 'Relate fractions (tenths) to decimal notation.', 3),
(4, 'math', 'Decimal Operations', 'Add and subtract decimals to two places.', 4),

-- Grade 5
(5, 'english', 'Alphabet', 'Refresher for late starters; rapid diagnostic pass.', 1),
(5, 'english', 'Words', 'Sight word fluency and spelling patterns.', 2),
(5, 'english', 'Sentences', 'Compound and complex sentence construction.', 3),
(5, 'english', 'Paragraphs', 'Multi-paragraph writing with transitions.', 4),
(5, 'english', 'Stories', 'Independent reading with comprehension checks.', 5),
(5, 'math', 'Counting', 'Diagnostic refresher for foundational number sense.', 1),
(5, 'math', 'Addition', 'Multi-digit addition fluency.', 2),
(5, 'math', 'Subtraction', 'Multi-digit subtraction fluency.', 3),
(5, 'math', 'Multiplication', 'Multi-digit multiplication fluency.', 4),
(5, 'math', 'Division', 'Long division with remainders.', 5),
(5, 'math', 'Fractions', 'Operations on fractions with unlike denominators.', 6),
(5, 'math', 'Decimals', 'Multiply and divide decimals; convert to/from fractions.', 7)
;
