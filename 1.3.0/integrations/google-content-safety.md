# Google Content Safety API

The Content Safety API is an AI classifier which issues a Child Safety prioritization recommendation on content sent to it.

## Requirements

Content Safety API users must conduct their own manual review in order to determine whether to take action on the content, and comply with applicable local reporting laws.

Industry and civil society third parties seeking to protect their platform against abuse can [apply to access the Content Safety API](https://protectingchildren.google/toolkit-interest-form/?roost-coop). Mention in your application that you are using the Coop review tool. Applications are subject to approval and require accepting Google's terms and conditions.

Coop currently supports image classification through the Google Content Safety API for the following file types:

- BMP
- GIF
- ICO
- JPEG
- PNG
- PPM
- TIFF
- WEBP

## Response

The response contains 1 of 5 priorities:

| Priority ENUM |
| ------------- |
| VERY_LOW      |
| LOW           |
| MEDIUM        |
| HIGH          |
| VERY_HIGH     |

The higher the priority, the more likely the image may be abusive content. However, this is an indication and not a confirmation of it. **You must always do a manual review to confirm and avoid false positives.** As such, this signal is only available for manual routing rules and not automated action rules.

## Best practices

- It is recommended for the image resolution to be around 640x480 pixels (about 300k pixels) for best performance.

- If you have an image smaller than 300K pixels, do NOT resize it to a larger image as it introduces noise and does not improve performance.

- For images larger than 300K pixels you may consider resizing them to 300K. The performance is not expected to degrade in this case.

- It is generally suggested to compress your images with some quality-preserving codec (for example WEBP or JPEG with 90+ quality) to reduce request size.

## Limitations

- Up to 32 images can be sent at a time.
- Image must be in one of the formats listed above.
- Total JSON body can't exceed 10MB in size.
- **Maximum QPS**: 200.
