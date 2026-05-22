import streamlit as st
import os
import streamlit.components.v1 as components

st.set_page_config(page_title="Management Dashboard", layout="wide")

st.title("CEO Daily Report - Management Dashboard")

# Read reports from a directory
REPORTS_DIR = "reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

report_files = [f for f in os.listdir(REPORTS_DIR) if f.endswith('.html')]
report_files.sort(reverse=True) # Show newest first

if not report_files:
    st.info("No reports found. Generate a report from the CEO Daily App and click 'Send Preview' to automatically sync it here via GitHub.")
else:
    selected_report = st.sidebar.selectbox("Select Report to View", report_files)
    
    if selected_report:
        st.subheader(f"Viewing: {selected_report}")
        with open(os.path.join(REPORTS_DIR, selected_report), "r", encoding="utf-8") as f:
            html_content = f.read()
            
        # Display the HTML
        components.html(html_content, height=1000, scrolling=True)
