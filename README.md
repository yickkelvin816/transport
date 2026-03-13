# Smart Transportation API (HK)

## Project Overview
Hong Kong commuters currently lack a centralized system that bridges the gap between traditional route planners and real-time traffic incidents. This system addresses that gap by integrating mock real-time traffic data (modeled after RTHK news), a custom MongoDB incident database, and the Google Gemini 3 Flash Preview LLM.

By utilizing Large Language Model (LLM) reasoning, the API provides intelligent travel advice that goes beyond simple ETAs, offering predictive insights and incident management. This backend foundation allows developers to build intuitive web interfaces for reporting incidents or seeking data-driven travel tips.

---

## Technical Stack
This project was developed using **Docker** to ensure environment consistency. The following core dependencies are utilized:

- **Generative AI:** `@google/genai` (^1.42.0)
- **Database:** `mongoose` (^9.2.1)
- **Scraping:** `axios` (^1.13.6), `cheerio` (^1.2.0)
- **Server:** `express` (^5.2.1)
- **Utilities:** `jsonrepair` (^3.13.2), `dotenv` (^17.3.1), `nodemon` (^3.1.14)

---

## Setup Instructions

### 1. Environment Configuration
For security reasons, the sensitive API credentials and connection strings are omitted from the repository.
1. Create a `.env` file in the root directory using the templete `.env.example`.
2. Refer to the **Technical Report** associated with this project to locate the necessary keys.

```env
PORT=3000
MONGODB_URI= # Found in Technical Report
GEMINI_API_KEY= # Found in Technical Report
```
3. Run `docker-compose up --build` to build a docker container.

### 2. Docker Installation
The development environment is containerized. To launch the application:
1. Ensure Docker Desktop is running.
2. Run the following command in the project root:
```
docker-compose up --build
```

### 3. Database Indexing
To enable the AI Deduplication and Similarity Search features, you must configure a Vector Search Index in your MongoDB Atlas cluster:
* Index Name: vector_index
* Field to Index: embeddings
* Dimensions: 768 (matching text-embedding-004)

### 4. API Features
#### Gemini-Powered Intelligence
* Batch Optimiser: Automatically triggers when 5 or more unanalyzed records exist, consolidating raw traffic fragments into clean, structured records.

* Deduplication: Uses vector similarity to prevent "same-day" redundant incident reports from cluttering the database.

* Historical Analysis: Aggregates a 12-month rolling window of district data to provide reliability scores (0.0-10.0) based on weighted factors like illegal parking and roadworks.

#### 5. API Specification 
Refer to the external link for full API specification. [Click here](https://leeds365-my.sharepoint.com/:b:/g/personal/bwzs0103_leeds_ac_uk/IQBqW0uLNoZ2SZ4j4lLB7tCmAV14IwYhhT-mXhBU4kvLn34?e=o6p5Tw)
* `GET /api/incidents/live`: Retrieves today's active (`on-going` or `investigating`) incidents.
* `GET /api/incidents/archive/:yyyy/:mm/summary`: Provides a statistical breakdown of traffic patterns for a specific period.
* `POST /api/advice`: Accepts a user query and returns structured travel advice with a "Probability of On-Time Arrival."

---

### Academic Disclaimer
This scraper and API were developed strictly for educational, non-commercial research purposes as part of academic coursework for COMP3011 Web Services and Web Data - University of Leeds.
