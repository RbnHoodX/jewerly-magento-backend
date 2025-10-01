import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import ExcelJS from "exceljs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase configuration missing");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

const MIGRATION_DIR = path.join(process.cwd(), "migration");

async function importComments() {
  console.log("💬 IMPORTING EMPLOYEE COMMENTS FROM EXCEL");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear existing employee comments
    console.log("\n🗑️ STEP 1: Clearing existing employee comments...");
    const { error: clearError } = await supabase
      .from("order_employee_comments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (clearError) {
      console.log(
        `⚠️ Warning clearing order_employee_comments: ${clearError.message}`
      );
    } else {
      console.log(`✅ Cleared order_employee_comments table`);
    }

    // Step 2: Get all orders for mapping
    console.log(
      "\n📦 STEP 2: Getting all orders for employee comments mapping..."
    );
    const orderLookup = new Map();
    let allOrders = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("❌ Error fetching orders:", error.message);
        break;
      }

      if (orders && orders.length > 0) {
        allOrders = allOrders.concat(orders);
        page++;
        console.log(`📊 Fetched ${orders.length} orders (page ${page})...`);
      } else {
        hasMore = false;
      }
    }

    allOrders.forEach((order) => {
      if (order.order_id) {
        orderLookup.set(order.order_id.toString(), order.id);
      }
    });

    console.log(`📊 Found ${allOrders.length} total orders for mapping`);

    // Step 3: Process Excel file
    console.log("\n📊 STEP 3: Processing Excel file...");
    const excelPath = path.join(MIGRATION_DIR, "Employee Comments.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];
    console.log(`📊 Sheet name: ${worksheet.name}`);

    // Convert worksheet to records
    const records = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const record = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getCell(1, colNumber).value;
        if (header) record[header] = cell.value;
      });
      if (Object.keys(record).length > 0) records.push(record);
    });

    console.log(`📊 Processing ${records.length} employee comment records`);

    // Step 4: Extract employee comments data
    console.log("\n💬 STEP 4: Extracting employee comments data...");
    const employeeCommentsData = [];
    let commentsProcessed = 0;
    let ordersNotFound = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const orderNumber = record["Order #"]?.toString();

      if (orderNumber && orderLookup.has(orderNumber)) {
        const orderId = orderLookup.get(orderNumber);

        // Parse date
        let dateAdded = new Date().toISOString();
        if (record["Date Added"]) {
          const dateStr = record["Date Added"].toString().trim();
          if (dateStr.includes("/")) {
            const [day, month, year] = dateStr.split("/");
            const parsedDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            );
            if (!isNaN(parsedDate.getTime())) {
              dateAdded = parsedDate.toISOString();
            }
          } else {
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              dateAdded = parsedDate.toISOString();
            }
          }
        }

        // Find file attachment columns
        const fileColumns = Object.keys(record).filter((key) =>
          key.startsWith("File Attachment ")
        );

        // Correct Excel row index (row 1 = header → +2)
        const rowNumber = i + 2;
        const worksheetRow = worksheet.getRow(rowNumber);
        const validAttachments = [];

        for (const fileColumn of fileColumns) {
          // Find col index for this header
          let colIndex = -1;
          worksheetRow.eachCell((cell, colNumber) => {
            const header = worksheet.getCell(1, colNumber).value;
            if (header === fileColumn) colIndex = colNumber;
          });

          if (colIndex > 0) {
            const cell = worksheet.getCell(rowNumber, colIndex);

            if (cell.hyperlink) {
              validAttachments.push(cell.hyperlink);
              if (commentsProcessed < 5) {
                console.log(`🔗 Hyperlink in ${fileColumn}: ${cell.hyperlink}`);
              }
            } else if (
              cell.value &&
              cell.value.formula &&
              cell.value.formula.startsWith("HYPERLINK(")
            ) {
              const match = cell.value.formula.match(
                /HYPERLINK\("([^"]+)",\s*"([^"]+)"\)/i
              );
              if (match) {
                validAttachments.push(match[1]);
                if (commentsProcessed < 5) {
                  console.log(`🔗 Formula in ${fileColumn}: ${match[1]}`);
                }
              }
            }
          }
        }

        if (validAttachments.length === 0) {
          employeeCommentsData.push({
            order_id: orderId,
            content: record["Comment"]
              ? String(record["Comment"]).trim()
              : null,
            employee_name: record["Employee Names"]
              ? String(record["Employee Names"]).trim()
              : null,
            created_at: dateAdded,
            file_url: null,
          });
          commentsProcessed++;
        } else {
          for (const fileUrl of validAttachments) {
            employeeCommentsData.push({
              order_id: orderId,
              content: record["Comment"]
                ? String(record["Comment"]).trim()
                : null,
              employee_name: record["Employee Names"]
                ? String(record["Employee Names"]).trim()
                : null,
              created_at: dateAdded,
              file_url: fileUrl,
            });
            commentsProcessed++;
          }
        }
      } else {
        ordersNotFound++;
        if (ordersNotFound <= 5) {
          console.log(
            `⚠️ Order not found for employee comment: ${orderNumber}`
          );
        }
      }
    }

    console.log(
      `📊 Created ${employeeCommentsData.length} employee comment records`
    );
    console.log(`📊 Orders not found: ${ordersNotFound}`);

    // Step 5: Import to Supabase
    console.log("\n💬 STEP 5: Importing employee comments...");
    const batchSize = 2000;
    let commentsCreated = 0;

    for (let i = 0; i < employeeCommentsData.length; i += batchSize) {
      const batch = employeeCommentsData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(employeeCommentsData.length / batchSize);

      console.log(
        `💬 Inserting batch ${batchNumber}/${totalBatches} (${batch.length})...`
      );

      try {
        const { error } = await supabase
          .from("order_employee_comments")
          .insert(batch);

        if (error) {
          console.error(
            `❌ Error inserting batch ${batchNumber}:`,
            error.message
          );
        } else {
          commentsCreated += batch.length;
          console.log(
            `✅ Batch ${batchNumber} inserted successfully (${batch.length})`
          );
        }
      } catch (err) {
        console.error(`❌ Unexpected error batch ${batchNumber}:`, err.message);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("🔄 EMPLOYEE COMMENTS IMPORT COMPLETED");

    const { count: finalCommentsCount } = await supabase
      .from("order_employee_comments")
      .select("*", { count: "exact", head: true });

    console.log(`📊 FINAL COMMENTS COUNT: ${finalCommentsCount}`);
    console.log(`📊 COMMENTS FROM EXCEL: ${employeeCommentsData.length}`);
    console.log(`📊 COMMENTS CREATED: ${commentsCreated}`);
    console.log(`📊 ORDERS NOT FOUND: ${ordersNotFound}`);

    if (commentsCreated === employeeCommentsData.length) {
      console.log("✅ All employee comments processed successfully!");
    } else {
      console.log(
        `⚠️ Processing mismatch: Expected ${employeeCommentsData.length}, processed ${commentsCreated}`
      );
    }
  } catch (error) {
    console.error("❌ Error during employee comments import:", error);
  }
}

importComments();
