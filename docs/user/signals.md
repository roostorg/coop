# Signals

Signals are what make Coop powerful. You use Signals to analyze **Items** and judge their characteristics. A Signal can be as simple as a basic check for a keyword or as complex as running an Item through an LLM or other AI model. A Signal takes an Item and spits out some information about the Item that you can use to make automated moderation decisions.

Coop has a library of Signals that you can use in your Rules, and each of them provides the flexibility to choose how strict or lax you want to be. For example, if your service is primarily for children, you'll want to prevent any form of nudity or sexual content. So you'll create a Rule, and in that Rule you'll choose Signals designed to detect nudity, such as nudity classifiers. If a nudity classifier Signal assigns a score of 95% to a user's profile picture (i.e. there is a 95% likelihood that the profile picture contains nudity), then you might have your Rule automatically ban the user.

To use a signal:

1. **Configure Integration**: An admin adds API credentials for the external service
2. **Use Signal in Rules**: Reference the signal in your moderation rules
3. **Content Evaluation**: When content is submitted, the signal is called and returns a score
4. **Action Execution**: If the score exceeds the threshold, the rule's action is executed

The Signals library contains signals for text analysis, location matching, and third-party API integrations.

## Text analysis

Coop offer a number of Signals to run analysis on text, including:

1. **Exact Keyword Matching:** Look for exact words or phrases in your content.

2. **Regular Expression (Regex) Matching:** Look for text patterns in your Items using [regular expressions](https://en.wikipedia.org/wiki/Regular_expression).

3. **Text Variant Matching:** Coop has an algorithm to detect common variants of strings of text. This is particularly useful to catch bad actors trying to evade your enforcement by using [leetspeak](https://en.wikipedia.org/wiki/Leet), replacing characters, adding punctuation in the middle of words, or other forms of evasion. For example, if you're looking for the word `Hello`, this will detect `h3||0` and `helllllllloooo` as matches.

## Location matching

You can set up Rules that target specific locations. For location matching to work, you'll need to include a [geohash](https://en.wikipedia.org/wiki/Geohash) to every Item you send to Coop representing the latitude-longitude location of the user who created it. Then create Rules that only action on Items created in or around particular locations. You can even create Matching Banks that contain geohash locations, so you can easily manage a large set of locations in one place.

## Third-party integrations

Connect to free safety-oriented APIs like Google Content Safety API, OpenAI Moderation API, Zentropi CoPE, and more at the click of a button. We've built several integrations into Coop; just enter your API key. Each integration includes a model card for consistent, comparable information about how it works.

See [Integrations](../integrations/) for information.

## Custom integrations

Platforms deploying Coop can add any signal through a custom integration; for example, if they've built their own machine learning models or have internal data that Coop can't access. See [Custom Integrations](../integrations/custom.md) for information.
