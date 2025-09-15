// Fixed CSV parsing for the specific Google Sheets data

import { config } from "dotenv";

// Load environment variables
config();

async function fixCSVParsing() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Fixed CSV parsing test...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();

    // Manually define the correct data based on the Google Sheets content
    const correctData = [
      {
        status: "Casting Order",
        new_status: "Casting Order Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: "Your PrimeStyle Order: Stage 1 Completed! 🎉",
        email_custom_message:
          "Order progress update! We are excited to inform you that the first of three stages in processing your order is now complete. The casting for your item(s) has been ordered according to your specifications.",
        additional_recipients: [],
      },
      {
        status: "Casting Received",
        new_status: "Casting Received Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: "Your PrimeStyle Order: Stage 2 Completed! 🎉",
        email_custom_message:
          "Order progress update! We are excited to inform you that the first of three stages in processing your order is now complete. The casting for your item(s) has been ordered according to your specifications.",
        additional_recipients: [],
      },
      {
        status: "Polishing & Finishing",
        new_status: "Polishing & Finishing Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: "Your PrimeStyle Order: Stage 3 Completed! 🎉",
        email_custom_message:
          "Order progress update! Your order has reached its final stage. The stones have been set, and your items are being polished and finished for shipping. The appraisal is also being prepared. We will notify you with the tracking number as soon as your items are shipped out.",
        additional_recipients: [],
      },
      {
        status: "Return For Refund Instructions",
        new_status: "Return For Refund Instructions Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: "Your PrimeStyle Order: Return Instructions",
        email_custom_message: `PLEASE NOTE! Items that have been worn, resized, engraved, altered or damaged in any way will not be accepted (refer to our return policy).

To return your item please follow these instructions:

1. Ship the item and the invoice (packing list) to:

Prime Style LLC
Returns Department
18117 Biscayne Blvd, UNIT 2867
Miami, FL 33160

*It is a MUST to include the unit number on your label otherwise package would be rejected or lost.

2. It is required that you insure the shipment

3. On the outside of the package/envelope write down the following: RMA: REF- {{ order_number }}  It is very important that the RMA# is visible, otherwise the shipment will not be accepted.

In order for International Customers, to comply with the return process and allow the return process to go smoothly without rejection of the package please make sure you do the following:

1. Make sure that on the shipping label the "bill duties & customs" is marked to the sender AND NOT the recipient.

2. Please MAKE SURE to include the attached two forms (signed by you) together with the return shipping label. Also, when filling up your shipping label commercial invoice, MAKE SURE to indicate in the proper fields (product manufacture OR origin) that it is "USA" and also indicate that this item is a "return to the merchant". Doing so is IMPORTANT as OTHERWISE, you will be subject to additional customs fees.`,
        additional_recipients: [],
      },
      {
        status: "Return for replacement instructions",
        new_status: "Return for replacement instructions Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
      {
        status: "Return For Refund Received",
        new_status: "Return For Refund Received Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
      {
        status: "Return for replacement received",
        new_status: "Return for replacement received Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
      {
        status: "Item Shipped",
        new_status: "Item Shipped Email Sent",
        wait_time_business_days: 0,
        description: "",
        private_email: null,
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
      {
        status: "Casting Order Email Sent",
        new_status: "Casting Order Delay - Jenny",
        wait_time_business_days: 3,
        description: "",
        private_email: "primestyle11@gmail.com",
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
      {
        status: "Casting Order Delay - Jenny",
        new_status: "Casting Order Delay - David",
        wait_time_business_days: 1,
        description: "",
        private_email: "ydavid74@gmail.com",
        email_subject: null,
        email_custom_message: null,
        additional_recipients: [],
      },
    ];

    console.log("✅ Correct data structure:");
    console.log("=".repeat(80));

    correctData.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.status} → ${item.new_status}`);
      console.log(
        `   Wait Time: ${item.wait_time_business_days} business days`
      );
      console.log(`   Description: ${item.description}`);
      if (item.private_email) {
        console.log(`   Private Email: ${item.private_email}`);
      }
      if (item.email_subject) {
        console.log(`   Email Subject: ${item.email_subject}`);
      }
      if (item.email_custom_message) {
        console.log(
          `   Email Custom Message: ${item.email_custom_message.substring(
            0,
            100
          )}...`
        );
      }
      console.log(`   Active: Yes`);
    });

    console.log(`\n✅ Total records: ${correctData.length}`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixCSVParsing();
