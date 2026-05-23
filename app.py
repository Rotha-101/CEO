import streamlit as st
import os
import streamlit.components.v1 as components
st.set_page_config(page_title="CEO Portal", layout="wide", initial_sidebar_state="collapsed")

# Inject CSS to make the app use 100% of the screen
st.markdown("""
<style>
    /* Premium UI & Full Screen Layout - Hex.tech Inspired */
    .block-container {
        padding-top: 1rem !important;
        padding-bottom: 0rem !important;
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        max-width: 100% !important;
        background-color: #ffffff;
    }
    header { display: none !important; }
    footer { display: none !important; }
    
    /* Hex.tech Segmented Control for Radio Buttons */
    div.row-widget.stRadio > div {
        background-color: #f1f5f9;
        border-radius: 8px;
        padding: 4px;
        display: inline-flex;
        border: none;
        box-shadow: none;
        gap: 4px;
    }
    
    div.row-widget.stRadio [role="radiogroup"] > label {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px 14px;
        border-radius: 6px;
        margin: 0;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    /* Selected tab styling using CSS :has() */
    div.row-widget.stRadio label:has(div[aria-checked="true"]) {
        background-color: #ffffff !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06) !important;
    }
    
    div.row-widget.stRadio label:has(div[aria-checked="true"]) [data-testid="stMarkdownContainer"] p {
        color: #0f172a !important;
        font-weight: 600 !important;
    }
    
    /* Unselected text */
    div.row-widget.stRadio [data-testid="stMarkdownContainer"] p {
        margin: 0 !important;
        font-weight: 500;
        font-size: 14px;
        color: #64748b;
    }
    
    /* Hide the radio circles */
    div.row-widget.stRadio div[role="radio"] div:first-child {
        display: none !important;
    }
    
    /* Hex.tech Sleek Selectbox */
    div[data-baseweb="select"] > div {
        border-radius: 8px !important;
        border: 1px solid #e2e8f0 !important;
        background-color: #ffffff !important;
        box-shadow: 0 1px 2px 0 rgba(0,0,0,0.03) !important;
        transition: all 0.2s ease;
        padding-top: 2px;
        padding-bottom: 2px;
    }
    div[data-baseweb="select"] > div:hover {
        border-color: #cbd5e1 !important;
    }
    
    /* Alerts */
    div[data-testid="stAlert"] {
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
</style>
""", unsafe_allow_html=True)

# Top Navigation Header
col1, col2 = st.columns([1, 1])

with col1:
    mode = st.radio("Portal Mode", ["📊 Management Viewer", "✍️ Editor App"], horizontal=True, label_visibility="collapsed")

if mode == "✍️ Editor App":
    st.info("You have full access to edit the report, configure settings, and sync to GitHub.")
    
    # Load the bidirectional Editor component from the public directory
    app_path = "public"
    if os.path.exists(os.path.join(app_path, "index.html")):
        # declare_component looks for index.html in the specified path
        editor_app = components.declare_component("editor_app", path=app_path)
        
        # Call the component to render it and receive data back via setComponentValue
        report_data = editor_app(default=None)
        
        # If the frontend sent us a report, save it locally immediately
        if report_data and isinstance(report_data, dict):
            if "filename" in report_data and "html" in report_data:
                REPORTS_DIR = "reports"
                os.makedirs(REPORTS_DIR, exist_ok=True)
                file_path = os.path.join(REPORTS_DIR, report_data["filename"])
                
                # We only write if the content differs to avoid excessive saves on re-runs
                should_save = True
                if os.path.exists(file_path):
                    with open(file_path, "r", encoding="utf-8") as f:
                        if f.read() == report_data["html"]:
                            should_save = False
                
                if should_save:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(report_data["html"])
                    # Use toast or success to indicate instant sync
                    st.toast("✅ Report synced directly to Streamlit for instant preview!")
                    
    else:
        st.error("The CEO Daily Report App could not be found. Please ensure it is built in the public/ folder as index.html.")

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
        st.info("No reports found. Generate a report from the Editor App and click 'Send Preview' to automatically sync it here.")
    else:
        with col2:
            selected_report = st.selectbox("Select Report to View", all_files, label_visibility="collapsed")
        
        if selected_report:
            with open(os.path.join(REPORTS_DIR, selected_report), "r", encoding="utf-8") as f:
                html_content = f.read()
                
            # Force Preview-Only Mode but preserve Date Navigation and Topbar
            force_preview_css = """
            <style>
              /* Hide the entire toolbar since Management Viewer has its own date selector */
              .toolbar { display: none !important; }
              
              /* Scale down the Management Viewer so it fits nicely on screen */
              html, .app-root { --app-scale: 0.75 !important; zoom: 0.75 !important; transform: none !important; }
              
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
            components.html(html_content, height=1800, scrolling=True)
