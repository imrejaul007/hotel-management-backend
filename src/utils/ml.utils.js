/**
 * Calculate similarity score between two feature vectors
 * @param {Object} vector1 First feature vector
 * @param {Object} vector2 Second feature vector
 * @returns {number} Similarity score between 0 and 1
 */
function calculateCosineSimilarity(vector1, vector2) {
    const keys = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const key of keys) {
        const val1 = vector1[key] || 0;
        const val2 = vector2[key] || 0;
        dotProduct += val1 * val2;
        norm1 += val1 * val1;
        norm2 += val2 * val2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate similarity between two items based on their features
 * @param {Object} item1 First item
 * @param {Object} item2 Second item
 * @param {Object} weights Feature weights
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(item1, item2, weights = {}) {
    const features = {
        categorical: ['type', 'location', 'amenities'],
        numerical: ['price', 'rating'],
        array: ['tags', 'features']
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Compare categorical features
    for (const feature of features.categorical) {
        if (item1[feature] && item2[feature]) {
            const weight = weights[feature] || 1;
            totalWeight += weight;
            totalScore += weight * (item1[feature] === item2[feature] ? 1 : 0);
        }
    }

    // Compare numerical features
    for (const feature of features.numerical) {
        if (item1[feature] !== undefined && item2[feature] !== undefined) {
            const weight = weights[feature] || 1;
            totalWeight += weight;
            const diff = Math.abs(item1[feature] - item2[feature]);
            const maxDiff = Math.max(item1[feature], item2[feature]);
            totalScore += weight * (1 - diff / maxDiff);
        }
    }

    // Compare array features
    for (const feature of features.array) {
        if (Array.isArray(item1[feature]) && Array.isArray(item2[feature])) {
            const weight = weights[feature] || 1;
            totalWeight += weight;
            const set1 = new Set(item1[feature]);
            const set2 = new Set(item2[feature]);
            const intersection = new Set([...set1].filter(x => set2.has(x)));
            const union = new Set([...set1, ...set2]);
            totalScore += weight * (intersection.size / union.size);
        }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Convert text to feature vector using TF-IDF
 * @param {string} text Text to convert
 * @param {Object} idfScores IDF scores for vocabulary
 * @returns {Object} Feature vector
 */
function textToVector(text, idfScores = {}) {
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);
    
    const termFreq = {};
    for (const word of words) {
        termFreq[word] = (termFreq[word] || 0) + 1;
    }

    const vector = {};
    for (const [word, freq] of Object.entries(termFreq)) {
        const idf = idfScores[word] || Math.log(1000); // Default IDF
        vector[word] = freq * idf;
    }

    return vector;
}

/**
 * Calculate Euclidean distance between two points
 * @param {Array} point1 First point coordinates
 * @param {Array} point2 Second point coordinates
 * @returns {number} Euclidean distance
 */
function calculateEuclideanDistance(point1, point2) {
    if (point1.length !== point2.length) {
        throw new Error('Points must have same dimensions');
    }

    return Math.sqrt(
        point1.reduce((sum, value, index) => {
            const diff = value - point2[index];
            return sum + diff * diff;
        }, 0)
    );
}

/**
 * Normalize a value between 0 and 1
 * @param {number} value Value to normalize
 * @param {number} min Minimum value in range
 * @param {number} max Maximum value in range
 * @returns {number} Normalized value between 0 and 1
 */
function normalize(value, min, max) {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
}

module.exports = {
    calculateSimilarity,
    calculateCosineSimilarity,
    textToVector,
    calculateEuclideanDistance,
    normalize
};
