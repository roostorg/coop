# Signals

Signals are what make Coop powerful. You use Signals to analyze **Items** and judge their characteristics. A Signal can be as simple as a basic check for a keyword or as complex as running an Item through an LLM or other AI model. A Signal takes an Item and spits out some information about the Item that you can use to make automated moderation decisions.

Coop has a library of Signals that you can use in your Rules, and each of them provides the flexibility to choose how strict or lax you want to be. For example, if your service is primarily for children, you'll want to prevent any form of nudity or sexual content. So you'll create a Rule, and in that Rule you'll choose Signals designed to detect nudity, such as nudity classifiers. If a nudity classifier Signal assigns a score of 95% to a user's profile picture (i.e. there is a 95% likelihood that the profile picture contains nudity), then you might have your Rule automatically ban the user.

The Signals library contains three types of Signals:

1. **Text Analysis:** Coop offer a number of Signals to run analysis on text, including  
   1. **Exact Keyword Matching:** Look for exact words or phrases in your content.  
   2. **Regular Expression (Regex) Matching:** Look for text patterns in your Items using [regular expressions](https://en.wikipedia.org/wiki/Regular_expression).  
   3. **Text Variant Matching:** Coop has an algorithm to detect common variants of strings of text. This is particularly useful to catch bad actors trying to evade your enforcement by using [leetspeak](https://en.wikipedia.org/wiki/Leet), replacing characters, adding punctuation in the middle of words, or other forms of evasion. For example, if you're looking for the word "Hello", we'll detect "h3||0" and "helllllllloooo" as matches.  
2. **3rd Party Integrations:** Connect to free safety-oriented APIs at the click of a button. We've built integrations with those companies' APIs so you don't have to; just enter your API key.  
3. **Location Matching:** If you want to set up Rules that target specific locations, you can do so with Coop’s location matching Signal. With every Item you send to Coop, you'll need to include a [geohash](https://en.wikipedia.org/wiki/Geohash) representing the latitude-longitude location of the user who created it. Then you can create Rules that only action on Items created in or around particular locations. You can even create Matching Banks that contain geohash locations, so you can easily manage a large set of locations in one place.  
4. **Custom Signals:** you can add any custom signal\! If you've built your own machine learning models or have some internal data that Coop can't access, you can add it through the signalService.

## External Signals Integration Guide

Coop supports integrating external classifiers (signals) for content moderation such as:

- **Prebuilt APIs**: OpenAI Moderation API, Google Content Safety API

## **How It Works**

1. **Configure Integration** \- Add API credentials for the external service  
2. **Use Signal in Rules** \- Reference the signal in your moderation rules  
3. **Content Evaluation** \- When content is submitted, the signal is called and returns a score  
4. **Action Execution** \- If the score exceeds the threshold, the rule's action is executed

### Example: OpenAI Integration

Here's a complete example showing how OpenAI is integrated into Coop.

#### 1. Signal Configuration

**Signal Class** - Each third-party signal extends the `SignalBase` class and implements the `run` method to call the external API.  
**Registration** - Signals are instantiated and registered in `server/services/signalsService/helpers/instantiateBuiltInSignals.ts`.

#### 2. Rules Implementation

**Using the Signal in a Rule**:

```ts
{
  "name": "Block Hate Speech",
  "conditions": {
    "field": "post.text",
    "signal": {
      "type": "OPEN_AI_HATE_TEXT_MODEL"
    },
    "comparator": "GREATER_THAN",
    "threshold": 0.8
  },
  "actions": [
    { "type": "BLOCK" }
  ]
}
```

**Execution Flow** (`server/condition_evaluator/leafCondition.ts`):

```ts
// 1. Extract content field
const value = getFieldValue(content, condition.field); // "post.text"

// 2. Get signal implementation
const signal = signalsService.getSignal(condition.signal.type);

// 3. Run signal
const result = await signal.run({
  value: { type: 'STRING', value },
  orgId: org.id,
});

// 4. Compare to threshold
const conditionMet = result.score > condition.threshold; // 0.85 > 0.8 = true

// 5. Execute action if condition met
if (conditionMet) {
  await executeAction({ type: 'BLOCK' });
}
```

## Supported Integrations

### Prebuilt APIs

| Integration | Signals | Configuration |
| :---- | :---- | :---- |
| **Moderation API by OpenAI** | There are two models you can use with this endpoint: **omni-moderation-latest:** This model and all snapshots support more categorization options and multi-modal inputs. <br> <br> **text-moderation-latest (Legacy):** Older model that supports only text inputs and fewer input categorizations. The newer omni-moderation models will be the best choice for new applications.  | OpenAI API key |
| **Content Safety API by Google** | V0: image classification | Content Safety API Key <br> <br> Industry and civil society third parties seeking to protect their platform against abuse can sign up to access the Content Safety API. Applications are subject to approval. You can submit an interest form through Google’s Child Safety Toolkit program [here](https://protectingchildren.google/toolkit-interest-form/?roost-coop).  |

#### Moderation API by OpenAI
Use the [moderations endpoint](https://platform.openai.com/docs/guides/moderation) to check whether text or images are potentially harmful. If harmful content is identified, you can take corrective action, like filtering content or intervening with user accounts creating offending content. The moderation endpoint is free to use.


#### Content Safety API by Google

The Content Safety API is an AI classifier which issues a Child Safety prioritization recommendation on content sent to it. Content Safety API users must conduct their own manual review in order to determine whether to take action on the content, and comply with applicable local reporting laws. Apply for API keys [HERE](https://protectingchildren.google/toolkit-interest-form/?roost-coop) and mention in your application that you are using the Coop review tool. Upon reviewing your application, Google will be back in touch shortly to take the application forward if you qualify.

The API accepts a list of raw image bytes. The supported file types are listed below:

* BMP
* GIF
* ICO
* JPEG
* PNG
* PPM
* TIFF
* WEBP

**Issue an HTTP Request**

To upload an image, issue a POST request to the API access point:

```json
POST /v1beta1/images:classify?key=your_key HTTP/1.1

HOST: contentsafety.googleapis.com
Content-Type: application/json

{
    images: ["<base64 encoding>"]
}
```
#### Response

The response contains 1 of 5 priorities:

| Priority ENUM |
| ------------- |
| VERY_LOW      |
| LOW           |
| MEDIUM        |
| HIGH          |
| VERY_HIGH     |

The higher the priority, the more likely the video may be abusive content. However, this is an indication and not a confirmation of it. You must always do a manual review to confirm and avoid false positives. This signal is only available for manual routing rules and not automated action rules.

#### Best practice
* It is recommended for the image resolution to be around 640x480 pixels (about 300k pixels) for best performance.

* If you have an image smaller than 300K pixels, do NOT resize it to a larger image as it introduce noises and does not improve performance.

* For images larger than 300K pixels you may consider resizing them to 300K. The performance is not expected to degrade in this case.

* It is generally suggested to compress your images with some quality-preserving codec (for example WEBP or JPEG with 90+ quality) to reduce request size.

#### Limitations
* Up to 32 images can be sent at a time.
* Image must be in one of the formats listed above.
* Total JSON body can't exceed 10MB in size.
* **Maximum QPS**: 200.


## Code Structure

```
server/
├── services/
│   ├── signalsService/
│   │   ├── signals/
│   │   │   ├── third_party_signals/
│   │   │   │   └── open_ai/           # OpenAI implementation
                └── google/           # Google implementation
│   │   │   └── SignalBase.ts          # Base class
│   │   └── helpers/
│   │       └── instantiateBuiltInSignals.ts
│   └── signalAuthService/             # Credential storage
│       └── signalAuthService.ts
├── rule_engine/
│   └── RuleEvaluator.ts               # Rule execution
└── condition_evaluator/
    └── leafCondition.ts               # Signal execution
```

## Key Files

- **Signal implementations**: `server/services/signalsService/signals/third_party_signals/`  
- **Credential management**: `server/services/signalAuthService/signalAuthService.ts`  
- **GraphQL schema**: `server/graphql/modules/integration.ts`  
- **Rule evaluation**: `server/condition_evaluator/leafCondition.ts`
