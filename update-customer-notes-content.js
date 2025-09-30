import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase configuration missing");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

async function updateCustomerNotesContent() {
  console.log("📝 UPDATING CUSTOMER NOTES CONTENT");
  console.log("=".repeat(50));

  try {
    // Step 1: Get all customer notes
    console.log("\n📦 STEP 1: Fetching all customer notes...");
    
    let allNotes = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: notes, error } = await supabase
        .from("order_customer_notes")
        .select("id, status, content")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error("❌ Error fetching customer notes:", error.message);
        break;
      }
      
      if (notes && notes.length > 0) {
        allNotes = allNotes.concat(notes);
        page++;
        console.log(`📊 Fetched ${notes.length} notes (page ${page})...`);
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allNotes.length} total customer notes`);

    // Step 2: Process and update notes
    console.log("\n📝 STEP 2: Processing customer notes...");
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const note of allNotes) {
      const { id, status, content } = note;
      
      // Format content based on the rules:
      // - If content exists: "{status} - {content}"
      // - If content doesn't exist: "{status}"
      let newContent;
      
      if (content && content.trim() !== '') {
        newContent = `${status} - ${content}`;
      } else {
        newContent = status;
      }
      
      // Only update if the content has changed
      if (newContent !== content) {
        const { error } = await supabase
          .from("order_customer_notes")
          .update({ content: newContent })
          .eq('id', id);
        
        if (error) {
          console.error(`❌ Error updating note ${id}:`, error.message);
        } else {
          updatedCount++;
          if (updatedCount <= 5) {
            console.log(`✅ Updated note ${id}: "${content}" → "${newContent}"`);
          }
        }
      } else {
        skippedCount++;
      }
    }

    // Step 3: Final status
    console.log("\n" + "=".repeat(50));
    console.log("🔄 CUSTOMER NOTES UPDATE COMPLETED");
    console.log(`📊 Total notes processed: ${allNotes.length}`);
    console.log(`📊 Notes updated: ${updatedCount}`);
    console.log(`📊 Notes skipped (no change): ${skippedCount}`);
    
    if (updatedCount > 0) {
      console.log("✅ Customer notes content updated successfully!");
    } else {
      console.log("ℹ️ No notes needed updating");
    }

  } catch (error) {
    console.error("❌ Error during customer notes update:", error);
  }
}

updateCustomerNotesContent();
