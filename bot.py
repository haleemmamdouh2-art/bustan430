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
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

# States
MAIN_MENU, GET_INPUT, BANNER_UPLOAD, SONG_INPUT, SONG_NAME_INPUT = range(5)

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
    keyboard = [[InlineKeyboardButton(f"{calendar.month_name[month]} {year}", callback_data="ignore")], [InlineKeyboardButton(day, callback_data="ignore") for day in ["M", "T", "W", "T", "F", "S", "S"]]]
    month_calendar = calendar.monthcalendar(year, month)
    for week in month_calendar:
        row = []
        for day in week:
            if day == 0: row.append(InlineKeyboardButton(" ", callback_data="ignore"))
            else: row.append(InlineKeyboardButton(str(day), callback_data=f"date_{year}_{month}_{day}"))
        keyboard.append(row)
    nav_row = [InlineKeyboardButton("❮ Prev", callback_data=f"cal_{year if month > 1 else year-1}_{month-1 if month > 1 else 12}"), InlineKeyboardButton("Next ❯", callback_data=f"cal_{year if month < 12 else year+1}_{month+1 if month < 12 else 1}")]
    keyboard.append(nav_row)
    keyboard.append([InlineKeyboardButton("🔙 Back to Draft", callback_data="back_to_menu")])
    return InlineKeyboardMarkup(keyboard)

def get_draft_keyboard(data):
    title = data.get('title', 'Not set'); loc = data.get('location', 'Not set'); note = data.get('note', 'Not set')
    date = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    flower = FLOWER_MAP.get(data.get('flower_type', 'rose'), '🌹 Rose')
    photo_count = len(data.get('photos', []))
    keyboard = [
        [InlineKeyboardButton(f"📅 Date: {date}", callback_data="set_date")],
        [InlineKeyboardButton(f"🖼️ Manage Photos ({photo_count})", callback_data="manage_photos")],
        [InlineKeyboardButton(f"📝 Title: {title[:20]}...", callback_data="set_title")],
        [InlineKeyboardButton(f"📍 Location: {loc[:20]}...", callback_data="set_loc")],
        [InlineKeyboardButton(f"📖 Story: {note[:20]}...", callback_data="set_note")],
        [InlineKeyboardButton(f"🌸 Flower: {flower}", callback_data="set_flower")],
        [InlineKeyboardButton("✅ Save Memory", callback_data="plant_now")]
    ]
    return InlineKeyboardMarkup(keyboard)

# =============================================
# COMMANDS
# =============================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    target = update.message if update.message else update.callback_query.message
    await target.reply_text("Welcome to Bustan's Journal Bot! 🌹\n\nSend me photos to plant a memory, or use the menu below to manage the site.")
    return ConversationHandler.END

async def admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    is_callback = update.callback_query is not None
    target = update.callback_query.message if is_callback else update.message
    try:
        res = supabase.table("memories").select("*").order("date", desc=True).limit(10).execute()
        keyboard = []
        for m in res.data:
            keyboard.append([InlineKeyboardButton(f"🖼️ {m['title'] or 'Untitled'} ({m['date']})", callback_data=f"manage_{m['id']}")])
        keyboard.append([InlineKeyboardButton("🖼️ Change Site Banner Photo", callback_data="change_banner")])
        keyboard.append([InlineKeyboardButton("🎵 Change Background Song", callback_data="change_song")])
        if is_callback: await update.callback_query.edit_message_text("🌿 **Garden Management**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        else: await target.reply_text("🌿 **Garden Management**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return MAIN_MENU
    except Exception as e:
        await target.reply_text(f"Error: {e}"); return ConversationHandler.END

async def banner_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    target = update.message if update.message else update.callback_query.message
    await target.reply_text("Please send the new photo for the site banner.")
    return BANNER_UPLOAD

async def song_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    target = update.message if update.message else update.callback_query.message
    await target.reply_text("Please send the YouTube link for the new background song.")
    return SONG_INPUT

# =============================================
# CALLBACKS & INPUTS
# =============================================
async def handle_photos_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if 'draft' not in context.user_data or not context.user_data['draft']:
        context.user_data['draft'] = {'photos': [], 'title': 'New Memory', 'location': 'Cairo, Egypt', 'note': 'A beautiful moment captured.', 'flower_type': 'rose', 'date': datetime.now().strftime("%Y-%m-%d")}
    
    photo_file = await update.message.photo[-1].get_file()
    context.user_data['draft']['photos'].append(photo_file)
    
    count = len(context.user_data['draft']['photos'])
    await update.message.reply_text(f"📸 Photo {count} added! Send more or finish below.", reply_markup=get_draft_keyboard(context.user_data['draft']))
    return MAIN_MENU

async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query; await query.answer(); action = query.data
    if action == "ignore": return MAIN_MENU
    if action == "change_banner": await query.edit_message_text("Send the new banner photo:"); return BANNER_UPLOAD
    if action == "change_song": await query.edit_message_text("Send the YouTube link for the song:"); return SONG_INPUT
    
    if action == "manage_photos" or action.startswith("del_photo_"):
        draft = context.user_data.get('draft')
        if action.startswith("del_photo_"):
            idx = int(action.split("_")[2])
            if 0 <= idx < len(draft['photos']):
                draft['photos'].pop(idx)
                await query.answer("✅ Photo removed from draft!")
        
        keyboard = []
        for i, p in enumerate(draft.get('photos', [])):
            keyboard.append([InlineKeyboardButton(f"🗑️ Delete Photo {i+1}", callback_data=f"del_photo_{i}")])
        keyboard.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="back_to_menu")])
        await query.edit_message_text(
            f"🖼️ **Manage Photos ({len(draft['photos'])} total)**\n\nTap a button to remove a photo.\n\n⚠️ **Note:** You must click **'Save Memory'** on the main menu to apply these changes to the website!", 
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        return MAIN_MENU

    if action.startswith("manage_"):
        mem_id = action.split("_")[1]
        keyboard = [[InlineKeyboardButton("✏️ Edit Details", callback_data=f"edit_existing_{mem_id}")], [InlineKeyboardButton("🗑️ Delete Memory", callback_data=f"confirm_del_{mem_id}")], [InlineKeyboardButton("🔙 Back to List", callback_data="back_to_admin")]]
        await query.edit_message_text(f"Manage memory {mem_id}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return MAIN_MENU
    
    if action == "back_to_admin": return await admin_menu(update, context)
    if action.startswith("confirm_del_"):
        mem_id = action.split("_")[2]
        keyboard = [[InlineKeyboardButton("❗ Yes, Delete Forever", callback_data=f"delete_final_{mem_id}")], [InlineKeyboardButton("❌ Cancel", callback_data="back_to_admin")]]
        await query.edit_message_text("⚠️ **Are you sure?**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown'); return MAIN_MENU
    if action.startswith("delete_final_"):
        mem_id = action.split("_")[2]; supabase.table("memories").delete().eq("id", mem_id).execute()
        await query.edit_message_text("✅ Memory deleted."); return await admin_menu(update, context)
    if action.startswith("edit_existing_"):
        mem_id = action.split("_")[2]; res = supabase.table("memories").select("*").eq("id", mem_id).execute()
        context.user_data['draft'] = res.data[0]; context.user_data['is_editing_id'] = mem_id
        await query.edit_message_text("Editing existing memory:", reply_markup=get_draft_keyboard(res.data[0])); return MAIN_MENU
    if action == "plant_now": return await plant_memory_final(query, context)
    if action == "back_to_menu": await query.edit_message_text("Back to menu...", reply_markup=get_draft_keyboard(context.user_data['draft'])); return MAIN_MENU
    if action == "set_date": await query.edit_message_text("Pick the date:", reply_markup=create_calendar()); return MAIN_MENU
    if action.startswith("cal_"):
        _, y, m = action.split('_'); await query.edit_message_text("Pick the date:", reply_markup=create_calendar(int(y), int(m))); return MAIN_MENU
    if action.startswith("date_"):
        _, y, m, d = action.split('_'); sd = f"{y}-{int(m):02d}-{int(d):02d}"; context.user_data['draft']['date'] = sd
        await query.edit_message_text(f"Date set to {sd}!", reply_markup=get_draft_keyboard(context.user_data['draft'])); return MAIN_MENU
    if action == "set_flower":
        keyboard = [[InlineKeyboardButton(v, callback_data=f"flower_{k}")] for k, v in FLOWER_MAP.items()]
        await query.edit_message_text("Pick a flower:", reply_markup=InlineKeyboardMarkup(keyboard)); return MAIN_MENU
    if action.startswith("flower_"):
        context.user_data['draft']['flower_type'] = action.replace("flower_", "")
        await query.edit_message_text("Flower updated!", reply_markup=get_draft_keyboard(context.user_data['draft'])); return MAIN_MENU
    prompt_map = {"set_title": "Send Title:", "set_loc": "Send Location:", "set_note": "Send Story:"}
    context.user_data['current_field'] = action; await query.edit_message_text(prompt_map[action]); return GET_INPUT

async def handle_banner_upload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Updating site banner... ⏳")
    try:
        photo_file = await update.message.photo[-1].get_file()
        fb = await photo_file.download_as_bytearray(); ext = photo_file.file_path.split('.')[-1]; fn = f"banner_{int(datetime.now().timestamp())}.{ext}"
        supabase.storage.from_("memories").upload(path=fn, file=bytes(fb), file_options={"content-type": f"image/{ext}"})
        url_res = supabase.storage.from_("memories").get_public_url(fn)
        supabase.table("site_settings").upsert([{"key": "hero_image_url", "value": url_res}]).execute()
        await update.message.reply_text("✅ Banner updated successfully!"); return ConversationHandler.END
    except Exception as e: await update.message.reply_text(f"Error: {e}"); return ConversationHandler.END

async def handle_song_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_song_link'] = update.message.text
    await update.message.reply_text("Link received! Now, what should the **Song Display Name** be? (e.g. Now Playing: Lovely ♪)")
    return SONG_NAME_INPUT

async def handle_song_name_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    name = update.message.text; link = context.user_data.get('new_song_link')
    await update.message.reply_text("Updating site music... ⏳")
    try:
        supabase.table("site_settings").upsert([{"key": "youtube_link", "value": link}, {"key": "music_label", "value": name}]).execute()
        await update.message.reply_text("✅ Background music and name updated!"); return ConversationHandler.END
    except Exception as e: await update.message.reply_text(f"Error: {e}"); return ConversationHandler.END

async def handle_input_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    field = context.user_data.get('current_field'); text = update.message.text
    field_map = {"set_title": "title", "set_loc": "location", "set_note": "note"}
    if 'draft' not in context.user_data: context.user_data['draft'] = {}
    context.user_data['draft'][field_map[field]] = text
    await update.message.reply_text("Updated! 📝", reply_markup=get_draft_keyboard(context.user_data['draft'])); return MAIN_MENU

async def plant_memory_final(query, context):
    draft = context.user_data.get('draft'); edit_id = context.user_data.get('is_editing_id')
    if not draft: await query.edit_message_text("Error: No draft found."); return ConversationHandler.END
    await query.edit_message_text("Saving... ⏳")
    try:
        final_urls = []
        for i, p in enumerate(draft['photos']):
            if isinstance(p, str): # Existing URL
                final_urls.append(p)
            else: # New File object
                fb = await p.download_as_bytearray(); ext = p.file_path.split('.')[-1]; fn = f"tg_{int(datetime.now().timestamp())}_{i}.{ext}"
                supabase.storage.from_("memories").upload(path=fn, file=bytes(fb), file_options={"content-type": f"image/{ext}"})
                final_urls.append(supabase.storage.from_("memories").get_public_url(fn))
        
        memory_data = {"photos": final_urls, "photo": final_urls[0] if final_urls else "", "title": draft['title'], "location": draft['location'], "note": draft['note'], "flower_type": draft['flower_type'], "date": draft['date']}
        if edit_id: supabase.table("memories").update(memory_data).eq("id", edit_id).execute()
        else: supabase.table("memories").insert(memory_data).execute()
        await query.message.reply_text("Memory successfully saved! 🌹✨"); context.user_data.clear(); return ConversationHandler.END
    except Exception as e: await query.message.reply_text(f"Error: {e}"); return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear(); await update.message.reply_text("Action cancelled."); return ConversationHandler.END

async def post_init(application):
    commands = [BotCommand("start", "Welcome"), BotCommand("admin", "Manage memories"), BotCommand("banner", "Update banner"), BotCommand("song", "Update music"), BotCommand("cancel", "Stop action")]
    await application.bot.set_my_commands(commands)

if __name__ == '__main__':
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).post_init(post_init).build()
    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.PHOTO, handle_photos_start), CommandHandler('admin', admin_menu), CommandHandler('banner', banner_cmd), CommandHandler('song', song_cmd)],
        states={
            MAIN_MENU: [CallbackQueryHandler(menu_callback), CommandHandler('admin', admin_menu), CommandHandler('banner', banner_cmd), CommandHandler('song', song_cmd), MessageHandler(filters.PHOTO, handle_photos_start)],
            GET_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_input_text), CommandHandler('admin', admin_menu)],
            BANNER_UPLOAD: [MessageHandler(filters.PHOTO, handle_banner_upload), CommandHandler('admin', admin_menu)],
            SONG_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_song_input), CommandHandler('admin', admin_menu)],
            SONG_NAME_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_song_name_input), CommandHandler('admin', admin_menu)],
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )
    app.add_handler(CommandHandler('start', start)); app.add_handler(conv_handler); print("Bot is blooming..."); app.run_polling()
