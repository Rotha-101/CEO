import streamlit as st
import os
import streamlit.components.v1 as components

st.set_page_config(page_title="CEO Portal", layout="wide", initial_sidebar_state="expanded")

# Inject CSS to make the app use 100% of the screen
st.markdown("""
<style>
    .block-container {
        padding-top: 0rem !important;
        padding-bottom: 0rem !important;
        padding-left: 0rem !important;
        padding-right: 0rem !important;
        max-width: 100% !important;
    }
    header { display: none !important; }
    footer { display: none !important; }
    #MainMenu { display: none !important; }
</style>
""", unsafe_allow_html=True)

# Sidebar navigation
st.sidebar.header("Navigation")
mode = st.sidebar.radio("Portal Mode", ["📊 Management Viewer", "✍️ Editor App"])
st.sidebar.markdown("---")

if mode == "✍️ Editor App":
    st.sidebar.info("You have full access to edit the report, configure settings, and sync to GitHub.")
    
    # Load the standalone application from the public directory
    app_path = os.path.join("public", "ceo-daily-report.html")
    if os.path.exists(app_path):
        with open(app_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        components.html(html_content, height=1200, scrolling=True)
    else:
        st.error("The CEO Daily Report App could not be found. Please ensure it is built in the public/ folder.")

elif mode == "📊 Management Viewer":
    # Read reports from a directory
    REPORTS_DIR = "reports"
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    all_files = [f for f in os.listdir(REPORTS_DIR) if f.endswith('.html')]
    
    def sort_key(filename):
        # Prioritize auto-generated preview reports (1) over manual uploads (0)
        # The filename contains an ISO timestamp, so alphabetical sorting within the group works perfectly
        if filename.startswith("SchneiTec_CEO_Daily_Report_Preview_"):
            return (1, filename)
        else:
            return (0, filename)
    
    all_files.sort(key=sort_key, reverse=True)
    
    if not all_files:
        st.sidebar.info("No reports found. Generate a report from the Editor App and click 'Send Preview' to automatically sync it here.")
    else:
        selected_report = st.sidebar.selectbox("Select Report to View", all_files)
        
        if selected_report:
            with open(os.path.join(REPORTS_DIR, selected_report), "r", encoding="utf-8") as f:
                html_content = f.read()
                
            # Force Preview-Only Mode but preserve Date Navigation and Topbar
            force_preview_css = """
            <style>
              /* Hide edit tools, history, export, import, print, screenshot, make report, save */
              #tabEdit,
              button[data-action="open-history"],
              button[data-action="export"],
              button[data-action="import"],
              button[data-action="print"],
              button[data-action="screenshot"],
              button[data-action="make-report"],
              button[data-action="make-preview-report"],
              button[data-action="open-settings"],
              button[data-action="save"] { display: none !important; }
              
              /* Hide edit view and modals */
              #editView, #settingsModal, #siteModal, #historyPanel { display: none !important; }
              
              /* Force preview view */
              #previewView { display: block !important; }
            </style>
            """
            if '</head>' in html_content:
                html_content = html_content.replace('</head>', force_preview_css + '</head>')
            else:
                html_content += force_preview_css
                
            # Display the HTML
            components.html(html_content, height=1200, scrolling=True)
