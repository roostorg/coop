# Hasher-Matcher-Actioner (HMA)

Coop integrates with Meta's open-source [Hasher-Matcher-Actioner (HMA)](https://github.com/facebook/ThreatExchange/tree/main/hasher-matcher-actioner) to provide perceptual hash matching for known CSAM, non-consensual intimate imagery (NCII), terrorist and violent extremist content (TVEC), and any custom hash banks you maintain.

Hash matching works by computing a perceptual fingerprint (PDQ for images, MD5 for video) of submitted media and checking it against databases of known harmful content. Unlike AI classifiers, a hash match against a verified database like NCMEC's is a strong, reliable signal; known content will match reliably even if it's been slightly modified.

## Prerequisites

- A running HMA instance accessible from your Coop server
- API credentials from any hash databases you want to use (e.g. NCMEC's Hash Sharing API, StopNCII)

## Connecting HMA to Coop

1. In Coop, go to **Settings → Integrations**.
2. Enter your HMA service URL.

Once connected, HMA signals will be available in Coop's signal library for use in routing rules and proactive rules.

## Managing Hash Banks

![Coop matching banks page showing a test hash bank created in the Coop UI](../images/coop-hma.png)

Hash banks are collections of known-harmful media fingerprints that you can reference in your rules. You can create and manage banks through the Coop UI, or sync them from external sources like NCMEC.

### Creating banks through Coop

The recommended approach is to create banks through **Settings → Matching Banks** in Coop. This registers the bank in both HMA and Coop's database automatically, making it immediately available in the rule builder.

Banks created through Coop are named in HMA using the convention `COOP_<ORGID>_<NORMALIZED_NAME>`, for example a bank named "Test Bank" for org `e7c89ce7729` becomes `COOP_E7C89CE7729_TEST_BANK` in HMA. This is what you will see in the HMA UI.

### Banks created directly in HMA

Banks created directly in HMA (via the HMA UI or seed scripts) will not appear in Coop's Matching Banks UI unless they are also registered in the `hash_banks` table. If you need to use an HMA-native bank in Coop rules, create a matching bank in the Coop UI first.

![HMA UI showing the bank created in Coop, along with a modal that appears if you manually upload media to the matching bank](../images/hma-ui-coop-banks.png)

You can use the HMA UI to manually add content to any bank for local testing, regardless of how the bank was created.

## NCMEC Hash Sharing

To match against NCMEC's database of known CSAM hashes, you need credentials for NCMEC's [Hash Sharing API](https://report.cybertip.org/ws-hashsharing/v2/documentation/), which is separate from the CyberTipline reporting API used to submit CyberTips.

> [!IMPORTANT]
> Hash Sharing API credentials are configured in HMA, not in Coop. Configure them via HMA's curator UI or by setting the `TX_NCMEC_CREDENTIALS` environment variable on the HMA service.

### Setup

1. Obtain Hash Sharing API credentials from NCMEC by [registering as an ESP](https://esp.ncmec.org/registration).
2. Configure the credentials in HMA (via HMA's curator UI or `TX_NCMEC_CREDENTIALS` env var).
3. In HMA, create a bank sourced from the NCMEC exchange. HMA will begin syncing hashes on its background fetch schedule (every 5 minutes by default).
4. The NCMEC-sourced bank will appear in Coop's **Matching Banks** once synced.

For details on routing NCMEC hash matches into a CSAM review workflow, see [NCMEC Reporting](ncmec.md).

## Using HMA Signals in Rules

Once HMA is connected and hash banks are configured, the image hash signal is available in both routing rules and proactive rules.

**If items are submitted by [user reports](../api/report.md)**: no enforcement rule is needed. Reported items are automatically enqueued for review, and a routing rule with the image hash condition will direct matches to the right queue.

![A routing rule using HMA hash matching](../images/hma-routing-rule.png)

**If items are submitted via the [items API](../api/items.md)** and you want Coop to proactively flag matches without a user report: create a proactive rule with the image hash condition and an action, typically "Send to Manual Review" or "Enqueue to NCMEC." Optionally pair it with a routing rule to send matches to a specific queue; otherwise they go to the default queue.

See [Automated Routing & Enforcement](../user/rules.md) for more on building rules.
