import os
import logging
import asyncio
import calendar
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler
)
from supabase import create_client, Client

# Supabase Credentials
SUPABASE_URL = "https://byqfgirtizfvbmvrkuts.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5cWZnaXJ0aXpmdmJtdnJrdXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjE0MjksImV4cCI6MjA5Mjg5NzQyOX0.KIh1RSlwO0ps4vT4tFBvB4qiamCxLyLhCtUvaVnYUvY"
TELEGRAM_TOKEN = "8556636256:AAH5uQ29DrY9zrEzrrKnj5fU_El-uQ5Ea7U"

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

# States
MAIN_MENU, GET_INPUT = range(2)

FLOWER_MAP = {
    'rose': '🌹 Rose',
    'tulip': '🌷 Tulip',
    'sunflower': '🌻 Sunflower',
    'lily': '🪷 Lily',
    'daisy': '🌼 Daisy'
}

# =============================================
# HELPERS
# =============================================
def create_calendar(year=None, month=None):
    now = datetime.now()
    if year is None: year = now.year
    if month is None: month = now.month
    
    keyboard = [
        [InlineKeyboardButton(f"{calendar.month_name[month]} {year}", callback_data="ignore")],
        [InlineKeyboardButton(day, callback_data="ignore") for day in ["M", "T", "W", "T", "F", "S", "S"]]
    ]
    
    month_calendar = calendar.monthcalendar(year, month)
    for week in month_calendar:
        row = []
        for day in week:
            if day == 0:
                row.append(InlineKeyboardButton(" ", callback_data="ignore"))
            else:
                row.append(InlineKeyboardButton(str(day), callback_data=f"date_{year}_{month}_{day}"))
        keyboard.append(row)
        
    nav_row = [
        InlineKeyboardButton("❮ Prev", callback_data=f"cal_{year if month > 1 else year-1}_{month-1 if month > 1 else 12}"),
        InlineKeyboardButton("Next ❯", callback_data=f"cal_{year if month < 12 else year+1}_{month+1 if month < 12 else 1}")
    ]
    keyboard.append(nav_row)
    keyboard.append([InlineKeyboardButton("🔙 Back to Draft", callback_data="back_to_menu")])
    
    return InlineKeyboardMarkup(keyboard)

def get_draft_keyboard(data):
    title = data.get('title', 'Not set')
    loc = data.get('location', 'Not set')
    note = data.get('note', 'Not set')
    date = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    flower = FLOWER_MAP.get(data.get('flower_type', 'rose'), '🌹 Rose')
    
    keyboard = [
        [InlineKeyboardButton(f"📅 Date: {date}", callback_data="set_date")],
        [InlineKeyboardButton(f"📝 Title: {title[:20]}...", callback_data="set_title")],
        [InlineKeyboardButton(f"📍 Location: {loc[:20]}...", callback_data="set_loc")],
        [InlineKeyboardButton(f"📖 Story: {note[:20]}...", callback_data="set_note")],
        [InlineKeyboardButton(f"🌸 Flower: {flower}", callback_data="set_flower")],
        [InlineKeyboardButton("✅ Plant Memory in Garden", callback_data="plant_now")]
    ]
    return InlineKeyboardMarkup(keyboard)

# =============================================
# COMMANDS
# =============================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to Bustan's Journal Bot! 🌹\n\n"
        "Send me some photos to start planting a new memory.\n"
        "Use /admin to manage your existing memories."
    )

async def admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        res = supabase.table("memories").select("*").order("date", desc=True).limit(10).execute()
        mems = res.data
        
        if not mems:
            await update.message.reply_text("The garden is currently empty.")
            return

        keyboard = []
        for m in mems:
            title = m['title'] if m['title'] else "Untitled"
            keyboard.append([InlineKeyboardButton(f"🖼️ {title} ({m['date']})", callback_data=f"manage_{m['id']}")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text("🌿 **Garden Management**\nSelect a memory to edit or delete:", reply_markup=reply_markup, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"Error: {e}")

# =============================================
# CONVERSATION & CALLBACKS
# =============================================
async def handle_photos_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['draft'] = {
        'photos': [],
        'title': 'New Memory',
        'location': 'Cairo, Egypt',
        'note': 'A beautiful moment captured.',
        'flower_type': 'rose',
        'date': datetime.now().strftime("%Y-%m-%d")
    }
    
    photo_file = await update.message.photo[-1].get_file()
    context.user_data['draft']['photos'].append(photo_file)
    
    count = len(context.user_data['draft']['photos'])
    msg = f"📸 {count} Photo(s) received!\n\nUse the buttons below to customize your memory."
    
    reply_markup = get_draft_keyboard(context.user_data['draft'])
    await update.message.reply_text(msg, reply_markup=reply_markup)
    return MAIN_MENU

async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    action = query.data
    if action == "ignore": return MAIN_MENU
    
    # --- ADMIN ACTIONS ---
    if action.startswith("manage_"):
        mem_id = action.split("_")[1]
        keyboard = [
            [InlineKeyboardButton("✏️ Edit Details", callback_data=f"edit_existing_{mem_id}")],
            [InlineKeyboardButton("🗑️ Delete Memory", callback_data=f"confirm_del_{mem_id}")],
            [InlineKeyboardButton("🔙 Back to List", callback_data="back_to_admin")]
        ]
        await query.edit_message_text(f"What would you like to do with this memory?", reply_markup=InlineKeyboardMarkup(keyboard))
        return MAIN_MENU

    if action == "back_to_admin":
        # Simulate update to call admin_menu logic
        # For simplicity, just call a function that edits the message
        res = supabase.table("memories").select("*").order("date", desc=True).limit(10).execute()
        keyboard = [[InlineKeyboardButton(f"🖼️ {m['title'] or 'Untitled'} ({m['date']})", callback_data=f"manage_{m['id']}")] for m in res.data]
        await query.edit_message_text("🌿 **Garden Management**\nSelect a memory to edit or delete:", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return MAIN_MENU

    if action.startswith("confirm_del_"):
        mem_id = action.split("_")[2]
        keyboard = [
            [InlineKeyboardButton("❗ Yes, Delete Forever", callback_data=f"delete_final_{mem_id}")],
            [InlineKeyboardButton("❌ Cancel", callback_data="back_to_admin")]
        ]
        await query.edit_message_text("⚠️ **Are you sure?**\nThis will remove the memory from the garden forever.", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return MAIN_MENU

    if action.startswith("delete_final_"):
        mem_id = action.split("_")[2]
        supabase.table("memories").delete().eq("id", mem_id).execute()
        await query.edit_message_text("✅ Memory deleted. The garden has been updated.")
        return ConversationHandler.END

    if action.startswith("edit_existing_"):
        mem_id = action.split("_")[2]
        res = supabase.table("memories").select("*").eq("id", mem_id).execute()
        m = res.data[0]
        context.user_data['draft'] = m
        context.user_data['is_editing_id'] = mem_id
        await query.edit_message_text("Editing existing memory. Change anything below:", reply_markup=get_draft_keyboard(m))
        return MAIN_MENU

    # --- DRAFT ACTIONS ---
    if action == "plant_now":
        return await plant_memory_final(query, context)
        
    if action == "back_to_menu":
        await query.edit_message_text("Draft updated! Back to menu...", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    if action == "set_date":
        await query.edit_message_text("Pick the date:", reply_markup=create_calendar())
        return MAIN_MENU

    if action.startswith("cal_"):
        _, year, month = action.split('_')
        await query.edit_message_text("Pick the date:", reply_markup=create_calendar(int(year), int(month)))
        return MAIN_MENU

    if action.startswith("date_"):
        _, y, m, d = action.split('_')
        selected_date = f"{y}-{int(m):02d}-{int(d):02d}"
        context.user_data['draft']['date'] = selected_date
        await query.edit_message_text(f"Date set to {selected_date}!", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    if action == "set_flower":
        keyboard = [[InlineKeyboardButton(v, callback_data=f"flower_{k}")] for k, v in FLOWER_MAP.items()]
        await query.edit_message_text("Pick a flower tag:", reply_markup=InlineKeyboardMarkup(keyboard))
        return MAIN_MENU

    if action.startswith("flower_"):
        context.user_data['draft']['flower_type'] = action.replace("flower_", "")
        await query.edit_message_text("Flower updated!", reply_markup=get_draft_keyboard(context.user_data['draft']))
        return MAIN_MENU

    # Text inputs
    prompt_map = {
        "set_title": "Send me the **Title**:",
        "set_loc": "Send me the **Location**:",
        "set_note": "Send me the **Story/Note**:"
    }
    context.user_data['current_field'] = action
    await query.edit_message_text(prompt_map[action], parse_mode='Markdown')
    return GET_INPUT

async def handle_input_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    field = context.user_data.get('current_field')
    text = update.message.text
    field_map = {"set_title": "title", "set_loc": "location", "set_note": "note"}
    
    context.user_data['draft'][field_map[field]] = text
    await update.message.reply_text("Updated! 📝", reply_markup=get_draft_keyboard(context.user_data['draft']))
    return MAIN_MENU

async def plant_memory_final(query, context):
    draft = context.user_data['draft']
    edit_id = context.user_data.get('is_editing_id')
    await query.edit_message_text("Saving your memory... ⏳")
    
    try:
        # If new memory, upload photos
        if not edit_id:
            uploaded_urls = []
            for i, photo_file in enumerate(draft['photos']):
                file_bytes = await photo_file.download_as_bytearray()
                ext = photo_file.file_path.split('.')[-1]
                filename = f"tg_{int(datetime.now().timestamp())}_{i}.{ext}"
                supabase.storage.from_("memories").upload(path=filename, file=bytes(file_bytes), file_options={"content-type": f"image/{ext}"})
                url_res = supabase.storage.from_("memories").get_public_url(filename)
                uploaded_urls.append(url_res)
            draft['photos'] = uploaded_urls
            draft['photo'] = uploaded_urls[0] if uploaded_urls else ""

        memory_data = {
            "photos": draft['photos'],
            "photo": draft['photo'],
            "title": draft['title'],
            "location": draft['location'],
            "note": draft['note'],
            "flower_type": draft['flower_type'],
            "date": draft['date']
        }
        
        if edit_id:
            supabase.table("memories").update(memory_data).eq("id", edit_id).execute()
            await query.message.reply_text("Memory successfully updated! ✨")
        else:
            supabase.table("memories").insert(memory_data).execute()
            await query.message.reply_text("Memory successfully planted! 🌹✨")
            
        context.user_data.clear()
        return ConversationHandler.END

    except Exception as e:
        logging.error(f"Error saving: {e}")
        await query.message.reply_text(f"Oops! Error: {e}")
        return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("Action cancelled.")
    return ConversationHandler.END

async def post_init(application):
    # Set commands in the bot menu
    commands = [
        BotCommand("start", "Welcome message"),
        BotCommand("admin", "Manage existing memories"),
        BotCommand("cancel", "Stop current action")
    ]
    await application.bot.set_my_commands(commands)

if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).post_init(post_init).build()
    conv_handler = ConversationHandler(
        entry_points=[
            MessageHandler(filters.PHOTO, handle_photos_start),
            CommandHandler('admin', admin_menu)
        ],
        states={
            MAIN_MENU: [CallbackQueryHandler(menu_callback)],
            GET_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_input_text)],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
        allow_reentry=True
    )
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('admin', admin_menu))
    app.add_handler(conv_handler)
    print("Bot is blooming...")
    app.run_polling()
