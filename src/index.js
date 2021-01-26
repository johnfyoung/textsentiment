import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/messages", { useUnifiedTopology: true });
let db = null;

const getTexts = async (number) => {
  try {
    const result = await db.collection("sms").aggregate([
      {
        '$unwind': '$addresses'
      }, {
        '$match': {
          'addresses': number,
          'type': '1'
        }
      }, {
        '$sort': {
          'date': -1
        }
      }, {
        '$limit': 100
      }
    ]);
    // console.log("got a result", result);
    return await result.toArray();
  } catch (err) {
    console.log("error pulling from db: ", err);
  }
}

async function saveSentiment(id, sentiment) {
  try {
    const result = await db.collection("sms").update({
      _id: id
    },
      {
        $set: {
          sentiment: sentiment
        }
      }
    );

    return result;
  } catch (err) {
    console.log("err saving sentiment", err);
  }
}

async function saveSentimentEntities(id, entities) {
  try {
    const result = await db.collection("sms").update({
      _id: id
    },
      {
        $set: {
          sentimentEntities: entities
        }
      }
    );

    return result;
  } catch (err) {
    console.log("err saving sentiment entities", err);
  }
}

async function getSentiment(text) {
  // Imports the Google Cloud client library
  const language = require("@google-cloud/language");

  // Instantiates a client
  const client = new language.LanguageServiceClient();

  const document = {
    content: text,
    type: "PLAIN_TEXT"
  };

  // Detects the sentiment of the text
  const [result] = await client.analyzeSentiment({ document: document });
  const sentiment = result.documentSentiment;
  return sentiment;
}

async function getEntitySentiment(text) {
  // Imports the Google Cloud client library
  const language = require("@google-cloud/language");

  // Instantiates a client
  const client = new language.LanguageServiceClient();

  const document = {
    content: text,
    type: "PLAIN_TEXT"
  };

  // Detects the sentiment of the text
  const [result] = await client.analyzeEntitySentiment({ document: document });
  const entities = result.entities;
  return entities;
}

const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};

(async () => {
  const args = process.argv.slice(2);
  if (args[0]) {
    try {
      await client.connect();
      db = await client.db("messages");

      const texts = await getTexts(args[0]);

      await asyncForEach(texts, async text => {
        if (text.body.split(/(\s+)/).length > 2) {
          if (!text.sentiment) {
            const sentiment = await getSentiment(text.body);
            const saveResult = await saveSentiment(text._id, sentiment);
            console.log(`${new Date(parseInt(text.date)).toLocaleDateString()}: ${text.body} : ${sentiment}`);
          }

          // if (!text.sentimentEntities) {
          //   const entities = await getEntitySentiment(text.body);
          //   const saveResult = await saveSentimentEntities(text._id, entities);
          //   console.log(`${new Date(parseInt(text.date)).toLocaleDateString()}: ${text.body} : ${entities}`);
          // }
        }
      })

      await client.close();
    } catch (err) {
      console.log("Application error: ", err)
    }
  } else {
    console.log("Usage: please supply a tex address (e.g. a 10 digit phone number");
  }
})()