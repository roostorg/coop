# Coop User Guide

The Coop UI has several pages accessible by a left-hand menu:

* Overview  
* Automated Enforcement  
* Policies  
* Review Console

As well as a bottom menu with buttons for logging out, managing settings, and viewing your profile.

## Dashboard

![Coop overview with key operational metrics such as total actions taken, jobs pending review, percentage breakdown of automated vs manual actions, and top policy violations](./images/coop-overview.png) 

The Overview dashboard provides top level metrics for Coop that can be filtered by hourly or daily breakdown across a window of time including:

* Total actions taken   
* Jobs pending review  
* Automated vs manual actions  
* Top policy violations  
* Decisions per moderator  
* Actions per rule (if rules are enabled)  
* Count of violations by Policy

## Settings

### Configuring Items and Actions

![Coop Item Dashboard showing the configuration of an Item Type: a post from the firehose with a schema of fields that get sent to Coop including text, unique ID as well as what format the fields are in](./images/coop-items.png) 

Item Types represent the different types of entities on your platform. For example, if you've built a social network that allows users to create profiles, upload posts, and comment on other users' posts, then your Item Types might be **Profile**, **Post**, **Comment**, and **Comment Thread**. If you've built a marketplace platform, your Item Types might be **Buyer**, **Seller**, **Product Listing**, **Product Review,** **Direct Message**, **Transaction**, etc. Every Item you send Coop needs to be an instance of exactly one of these Item Types.

When creating an Item Type, define the schema to include which fields will be included and shown to reviewers. These fields are also available in any rule logic to connect with signals for routing or automation.

![Coop Action Dashboard showing a table of configured custom actions like: send warning, label as spam, delete content, delete account, ban email](./images/coop-actions.png) 

Actions represent any action you can perform on Items. Some common examples include Label, Send Warning, Delete, Ban, Mute, Send to Manual Review, Approve, etc. 

![Creating an action in Coop: add the name, description, what item types the action can run on, and a callback URL](./images/coop-define-action.png) 

For every Action you define in Coop, you have to expose the action through an API endpoint that can receive requests from Coop. Whenever your rules determine that some Item should receive an Action, Coop will send a POST request to the Action's API endpoint. When your server receives that POST request, your code should actually perform the corresponding action.

![Coop integration page showing two cards to set up API access to Google's Content Safety API and OpenAI's Moderation API](./images/coop-api-keys.png) 
Coop uses an API key to gate its endpoints. Use the UI to generate an API key to authenticate any requests Coop makes to your organization’s endpoints. 

### Integrations
![API Keys: Coop uses APIs to authenticate requests. UI allows rotating the key and adding a webhook signature verification key](./images/coop-integrations.png) 
Coop comes with pre-built integrations to common software used for online safety. Add your API key to enable integrations like OpenAI’s Moderation API or Google’s Content Safety API, and set up your instance of Meta’s Hasher-Matcher-Actioner.

### User Management
![User management page in Coop showing different users with different emails and roles assigned to them. There is an Approval Status column and a column showing when they were created](./images/coop-manage-users.png) 

Coop uses role-based access controls to make sure the right people can access and view the right data. You can use the UI to invite more users and either copy the link for them to sign up with an account, or set up an email service to email the link to the invited user.   


### User Roles

Coop comes with 7 predefined roles that can be further customized:

| User Role | Access Manual Review Tool | View all Queues | Create, Delete and Edit Queues | Create, Delete and Edit Rules | Access NCMEC data  | Access Insights |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Admin | Yes | Yes | Yes | Yes | Yes | Yes |
| Moderator Manager | Yes | Yes | Yes | No | Yes | Yes |
| Analyst/Rules Manager | No | Yes | No | Yes | No | Yes |
| Child Safety Moderator | Yes | No | No | No | Yes | No |
| Moderator | Yes | No | No | No | No | No |
| External Moderator | Yes | No | No | No | No | No |

**Admin**  
Admins manage their entire organizations. They have full control over all of the organization's resources and settings within Coop.

**Analyst**  
Analysts can view metrics for all Rules, create or edit Draft and Background Rules, and run Backtests. They cannot create or edit Live Rules, run Retroaction on Live rules, or edit any other resources (Actions, Content Types, Signals, other Users, etc.). In short, they can experiment with Background Rules and view Rule metrics, but cannot affect any Live Rules or other features that actually mutate your data.

**Child Safety Moderator**  
Child Safety Moderators have the same permissions as Moderators, but they are also able to review Child Safety jobs and can see previous Child Safety decisions.

**External Moderator**  
External Moderators can only review jobs in the Manual Review tool. They cannot see any decisions or use any other tooling

**Moderator**  
Moderators can view the Manual Review tool, but are only able to review jobs from queues that they've been given permission to see. They can also view overall Manual Review metrics. They cannot see any Child Safety-related jobs or decisions.

**Moderator Manager**  
Moderator managers can view and edit queues within the Manual Review Tool. They have full control over the permissions that moderators have, and the Routing Rules that determine how to route each incoming job to the right queue.

**Rules Manager**  
Rules Managers can create, edit, and deploy Rules, and they can view all metrics related to Rules. They cannot create, edit, or delete other organization-level settings, including Actions, Item Types, Manual Review Queues, or other Users in the organization.


Once you invite a new user to Coop, you can either configure an email service to send the link to that person or copy the invite link and share it directly with them.



### Wellness and Safety

Reviewer safety and well-being is critical. Trust & Safety is an incredibly difficult field of work, and it can take a severe mental toll, especially for the moderators who are on the front line, reviewing disturbing content for hours on end every day.

That's why Coop includes customizable settings to prioritize reviewer safety. These come in two forms:
![Coop's organization safety settings where you can set the baseline resilience settings on media such as a blurring scale, grayscale toggle, and auto-mute video toggle](./images/coop-org-safety.png) 

1. **Company-wide Safety Settings:** If you are an Admin in your platform’s Coop organization, you can set the default safety settings for every employee at your company who has their own login credentials. Those are configured in your Employee Safety settings page.  

![Coop's individual user safety settings where users can override the baseline resilience settings with their own preferences on media such as a blurring scale, grayscale toggle, and auto-mute video toggle](./images/coop-user-settings.png) 

2. **Personal Safety Settings:** Any user can customize their own personal safety settings in their account settings page. These will override the default, company-wide safety settings and allow users to create the best experience for themselves.


For both levels of safety settings, you can customize the following properties:

1. **Image & video blur strength:** you can configure whether images and videos are always blurred by default, along with the strength of the blur. When images are blurred within Coop, hovering over the image with your mouse will unblur the image, and moving your mouse outside the image will blur it again. When videos are blurred within Coop, playing the video will unblur it.  
2. **Image & video grayscale:** you can decide whether images and videos are displayed in grayscale or in full color.  
3. **Video muted by default:** you can ensure videos are always muted by default, even if your device's volume is on.

## Policies
![Policy Dashboard showing 4 policies: Fraud, Nudity, Scams, Spam. There's a button to create new policies as well as options to add sub-policies for each existing policy and edit or delete them](./images/coop-policies.png) 
Policies are categories of harm that are prohibited or monitored on your platform. Some typical examples include Spam, Nudity, Fraud, Violence, etc. Policies can have sub-policies underneath them, so the Spam policy could have sub-policies like Commercial Spam, Repetitive Content, Fake Engagement, Scams and Phishing, etc., all of which are specific types of Spam that could occur on your platform.

It is often useful (and in some cases, required by some legislation) to tie every Action you take to one or more specific Policies. For example, you could Delete a comment under your Nudity policy, or you could Delete it under your Spam policy. Coop allows you to track those differences and measure how many Actions you've taken for each Policy. That way, you can see how effectively you're enforcing each Policy over time, identify Policies for which your enforcement is poor or degrading, and report performance metrics to your team (or to regulators).

Policies added in Coop’s UI will be visible to reviewers directly in the review flow, so they can easily reference policies and enforcement guidelines.

Learn more about Policies from the [Trust & Safety Professional Association.](https://www.tspa.org/curriculum/ts-fundamentals/policy/policy-development/)


## Manual Review

### Queues
![Coop's manual review tool showing 5 example queues: media, default queue, fraud, scams, and spam. There are buttons to create a new queue, start reviewing each queue, delete all jobs, and edit or delete individual queues.](./images/coop-review-console.png) 

Coop uses [Queues](https://en.wikipedia.org/wiki/Queue_\(abstract_data_type\)) (i.e. ordered containers) to organize tasks. When you create a task in Coop, the task will enter a Queue and wait to be reviewed. Then, when a user visits the Queue dashboard and clicks "Start Reviewing" on a particular Queue, Coop pulls the oldest task in the Queue so the user can review it. After a user makes a decision on a task, they will automatically see the next oldest task until the Queue is empty or the user stops. Coop will automatically make sure that two moderators won't receive the same job to avoid duplicate work.  

Queues can be starred to prioritize at the top of the review console (per user) and show the number of pending jobs.

You may want to restrict which Actions can be triggered from a particular Queue. When you create or edit a Queue, you can configure which Actions are hidden for that Queue through its "Hidden Actions" setting.

### Task View
![A review job in Coop with user data redacted. Shows what time the report was received, what kind of item it is, who created the report and for what reason, the # of reports on the task, and information about the post itself. Users can add internal comments for their teammates and view the policy to check what enforcement guidelines are. There is a list of decisions users can make on the task and a button to skip the task](./images/coop-task-view.png)

The task (aka Job) view, shows information about the flagged content or actor being reviewed. Each task has its own hyperlink and can be shared across anyone at your organization who is allowed to access Coop.   
When a user reviews a task, Coop will show as much relevant information about the task and its corresponding Item as possible. As a baseline, the Item's fields will render, and depending on the Item's type (e.g. whether it's a DM, Comment, Profile, etc.), Coop will try to render additional relevant information and surrounding context, including:

* Associated user account connected to the content  
* Additional content associated with the same user

Default actions include:

* Ignore (task is closed with no action taken)  
* Enqueue to NCMEC (moves the task to the NCMEC review queue and converts it into a User type review, aggregating all media associated with the user)  
* Move (moves the task to another existing queue)

Any Actions you configure will also show up. You can hide specific actions in specific queues when creating or editing a queue. 

## Investigation

![The Investigation tool in Coop with user data redacted. Shows all information Coop knows about a given entity/user.](./images/coop-investigation.png) 
You can use the Investigation tool (either plug in the unique ID of the Item or click through from a manual review task) to see more information about it:

* The Item itself, including all relevant attributes and metadata Coop has on that Item.  
* The user who created the Item (if applicable), and all the attributes and metadata Coop has on the user.  
* The details and full context of any previous actions taken on the Item, and the user who created it.  
* Other Items that are closely related to the main Item you're investigating. For example, if you're investigating a single comment within a larger comment thread, we'll show you preceding and subsequent comments in the thread.

You can also manually take action on the Item as you're investigating it. This is useful when you want to take action but aren't reviewing the Item within the context of a Review Queue.

## Automated Enforcement

Read more about rules in Coop in the [rules doc](RULES.md#automated-action-rules).

### Matching Banks
![The Matching Banks page showing Text Banks and Location Banks in different tabs. There are 3 text banks: scam keywords, sexually explicit, and a regex check for URL shorteners](./images/coop-banks.png) 

A Matching Bank is a way to keep track of a large list of values that you'd want to check for matches. For example, you could create a Matching Bank that holds 10,000 keywords, and you can check every new post or comment to see if the text in the post or comment matches any of the 10,000 banned keywords in the Matching Bank. You can build Rules that reference your Matching Banks, so you don't have to list out all 10,000 banned keywords every time you create a Rule that checks for matches against those keywords.

You can also use regex in rules, for example a regex checking if a URL has been shortened:  
![A text bank using regex to check for URL shorteners](./images/coop-regex-bank.png) 
These banks can then be used as signals in both automatic enforcement rules and routing rules for manual review.  


#### Hash Banks
Coop integrates with  hasher-matcher-actioner (HMA), providing a configurable way to match known CSAM, non-consensual intimate imagery, terrorist and violent extremist content, and any internal hash banks you maintain. Setup requires API credentials from supported hash databases like NCMEC and Tech Against Terrorism. Read more about HMA documentation here.

HMA signals are available as a signal in Coop’s signal library.

#### Location Banks
![Creating a location bank for the middle of Times Square using a geohash](./images/coop-location-bank.png) 

A Location Matching Bank holds a list of [geohashes](https://en.wikipedia.org/wiki/Geohash) or [Google Maps Places](https://developers.google.com/maps/documentation/places/web-service), which are two types of references to geographical locations. This can be helpful if you have a list of locations where you want to apply a different set of Rules. For example, you can apply stricter sexual content Rules on college and high school campuses than you do elsewhere.

## Appeals
![Coop's review console in the Appeals tab, showing one queue for any appeals ubmitted by users who have had an action applied on them or their content](./images/coop-appeal-queues.png) 
When you make a decision that affects a user on your platform, you may want to give them the ability to "appeal" your decision (and the EU's [Digital Services Act](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=COM%3A2020%3A825%3AFIN) requires this for many platforms). If a user appeals a moderation decision, you'll send that Appeal to Coop's Appeal API so that a moderator can review the Appeal and decide whether or not to overturn the original decision. 

![The Job view of an Appeal task. Information displays who submitted the appeal and the original action as well as the original content. Decisions are to accept or reject the appeal.](./images/coop-appeal-task.png) 

Reports and appeals can be closely related. For example:

* User A can report User B's profile, which you would send to Coop through the Report API.  
* If a moderator suspend's User B, then User B may appeal that suspension decision, which you would send to Coop through the Appeal API.  
* A different moderator can then accept the Appeal and overturn the suspension, or they can reject the Appeal and sustain the suspension.

## Recent Decision Log

Coop logs all actions taken in a Recent Decisions Log that includes basic information like the decision(s) taken on each Job and the user who made the decision.

![Coop's recent decisions page showing a log of all actions taken in coop and who took the action. There are buttons to refresh the table, download all decisions, and download only the tasks skipped by users](./images/coop-recent-decisions.png) 
 You can also see the full Job itself if you decide you want to investigate further, take additional Actions, or overturn a previous Decision.

## NCMEC Review and Reporting

Coop is integrated with the [CyberTip Reporting API](https://report.cybertip.org/ispws/documentation) from the National Center for Missing and Exploited Children. In order to review accounts and content to report to NCMEC, you must have:

1. A manual review queue called “NCMEC Review”  
2. A User item type that is a RELATED_ITEM field for associated content. This stores a structured reference to the User item. NCMEC-type jobs extract the user identifier from this structured reference to look up the full user in the Item Investigation Service.  
   1. Coop will automatically convert content Item Types and aggregate all media associated with the user to convert the job into a NCMEC-type job. This creates a detailed NCMEC report around one user, rather than multiple NCMEC reports for multiple pieces of content from the same user.

![Coop's NCMEC Reporting task view. This differs from the usual task view as it aggregates all media associated wih a user. There are keyboard shortcuts to apply specific industry classifications, a dropdown for selecting the incident type, and add labels per NCMEC's CyberTip fields](./images/coop-ncmec-job.png) 
The NCMEC job UI includes:

* Incident Type category (from the [Reporting API](https://report.cybertip.org/ispws/documentation/index.html#incident-summary)). Values include:  
  * Child Pornography (possession, manufacture, and distribution)  
  * Child Sex Trafficking  
  * Child Sex Tourism  
  * Child Sexual Molestation  
  * Misleading Domain Name  
  * Misleading Words or Digital Images on the Internet  
  * Online Enticement of Children for Sexual Acts  
  * Unsolicited Obscene Material Sent to a Child  
* [Industry categorization](https://report.cybertip.org/ispws/documentation/index.html#incident-summary) (A categorization from the ESP-designated categorization scale):  
  * A1  
  * A2  
  * B1  
  * B2  
* [Labels (file annotations)](https://report.cybertip.org/ispws/documentation/index.html#file-annotations):  
  * **animeDrawingVirtualHentai**: The file is depicting anime, drawing, cartoon, virtual or hentai.  
  * **potentialMeme**: The file is being shared/posted out of mimicry or other seemingly non-malicious intent.  
  * **viral:** The file is circulating rapidly from one user to another.  
  * **possibleSelfProduction**: The file contains content that is believed to be self-produced.  
  * **physicalHarm**: The file depicts an intentional act of causing physical injury or trauma to a person.  
  * **violenceGore**: The file depicts graphic violence, including but not limited to acts of brutality or detailed or vivid gruesomeness.  
  * **bestiality**: The file involves an animal.  
  * **liveStreaming**: The file depicts content that was streamed live at the time it was uploaded.  
  * **infant**: The file depicts an infant.  
  * **generativeAi**: The file contains content that is believed to be Generative Artificial Intelligence.
