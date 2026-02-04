import streamlit as st
import pandas as pd
import altair as alt
import json
import os

st.set_page_config(
    page_title="Productivity Tracker",
    layout="wide",
    initial_sidebar_state="collapsed"
)

"""
Theme Configuration - Match Focus Tree design (calm, light green)
"""
st.markdown("""
<style>
    :root {
        --primary-green: #2e7d32;
        --bg-light: #f7fbf8;
        --bg-gradient: linear-gradient(180deg, #f1f8f3 0%, #ffffff 100%);
        --card-white: #ffffff;
        --text-muted: #6b6b6b;
        --border-light: #e6e6e6;
    }

    /* Main background */
    .stMainBlockContainer {
        background: var(--bg-gradient);
        padding: 28px !important;
    }

    /* Container */
    [data-testid="stAppViewContainer"] {
        background: var(--bg-gradient);
    }

    /* Tabs styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0;
        background: transparent;
        border-bottom: 1px solid var(--border-light);
    }

    .stTabs [data-baseweb="tab"] {
        padding: 16px 20px;
        font-weight: 600;
        color: var(--text-muted);
        border-bottom: 3px solid transparent;
        transition: all 0.2s ease;
    }

    .stTabs [aria-selected="true"] {
        color: var(--primary-green);
        border-bottom-color: var(--primary-green) !important;
    }

    .stTabs [aria-selected="false"]:hover {
        color: var(--primary-green);
        opacity: 0.7;
    }

    /* Buttons */
    .stButton > button {
        background-color: var(--primary-green);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 600;
        transition: all 0.2s ease;
        width: 100%;
    }

    .stButton > button:hover {
        background-color: #1b5e20;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);
    }

    .stButton > button:active {
        transform: translateY(0);
    }

    /* Input fields */
    .stNumberInput > div > div > input,
    .stTextInput > div > div > input {
        border-radius: 8px;
        border: 1px solid var(--border-light) !important;
        padding: 10px 12px !important;
        font-size: 14px;
    }

    .stNumberInput > div > div > input:focus,
    .stTextInput > div > div > input:focus {
        border-color: var(--primary-green) !important;
        box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1) !important;
    }

    /* Expander */
    .streamlit-expanderHeader {
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid var(--border-light);
        padding: 12px 16px;
        font-weight: 600;
        color: var(--text-muted);
        transition: all 0.2s ease;
    }

    .streamlit-expanderHeader:hover {
        background: #f3f4f6;
        color: var(--primary-green);
    }

    .streamlit-expanderContent {
        background: #fafafa;
        border-radius: 0 0 8px 8px;
        padding: 16px;
        border: 1px solid var(--border-light);
        border-top: none;
    }

    /* Markdown styling */
    h1, h2, h3, h4, h5, h6 {
        color: var(--text-muted);
        font-weight: 700;
    }

    h3 {
        color: var(--primary-green);
        margin-top: 24px;
        margin-bottom: 16px;
    }

    /* Columns spacing */
    [data-testid="column"] {
        padding: 0 8px;
    }

    /* Chart container */
    .vega-embed {
        border-radius: 8px;
        overflow: hidden;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #f1f8f3 0%, #ffffff 100%);
    }

    /* General text */
    body, p, span {
        color: var(--text-muted);
    }

    /* Metric value styling */
    .metric-emoji {
        font-size: 20px;
        margin: 0 4px;
    }
</style>
""", unsafe_allow_html=True)

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
BLOCKS = ["morning", "afternoon"]

COLOR_PALETTE = [
    "#4285F4",
    "#EA4335",
    "#FBBC05",
    "#34A853",
    "#9C27B0",
    "#00ACC1",
]

DATA_FILE = os.path.join(os.path.dirname(__file__), "productivity_data.json")

# Nếu chạy từ Electron, sử dụng userData folder, ngược lại sử dụng APPDATA
if "FOCUS_TREE_DATA_DIR" in os.environ:
    data_dir = os.environ["FOCUS_TREE_DATA_DIR"]
    os.makedirs(data_dir, exist_ok=True)
    DATA_FILE = os.path.join(data_dir, "productivity_data.json")
else:
    # Fallback: sử dụng APPDATA
    appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
    data_dir = os.path.join(appdata, "FocusTree")
    os.makedirs(data_dir, exist_ok=True)
    DATA_FILE = os.path.join(data_dir, "productivity_data.json")

def load_data():
    """
    Tải dữ liệu từ file JSON nếu tồn tại, ngược lại khởi tạo dữ liệu trống
    """
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for day in DAYS:
                if day not in data:
                    data[day] = {block: [] for block in BLOCKS}
            return data
        except Exception:
            pass
    return {day: {block: [] for block in BLOCKS} for day in DAYS}

def save_data():
    """
    Lưu dữ liệu vào file JSON
    """
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(st.session_state.week_data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

"""
Initialize application state
"""
if "week_data" not in st.session_state:
    st.session_state.week_data = load_data()

"""
Utility functions
"""
def add_stack(day, block, stack_type, minutes):
    stacks = st.session_state.week_data[day][block]

    """
    Enforce alternating rule
    """
    if not stacks and stack_type != "work":
        return
    if stacks and stacks[-1][0] == stack_type:
        return

    stacks.append((stack_type, minutes))
    save_data()


def remove_stack(day, block):
    stacks = st.session_state.week_data[day][block]
    if stacks:
        stacks.pop()
        save_data()


def clear_block(day, block):
    st.session_state.week_data[day][block] = []
    save_data()


def summarize_block(day, block):
    work = 0
    rest = 0
    for t, m in st.session_state.week_data[day][block]:
        if t == "work":
            work += m
        else:
            rest += m
    return work, rest


def build_chart_df(block):
    rows = []

    for day in DAYS:
        stacks = st.session_state.week_data[day][block]

        # Zero baseline row to force day rendering
        rows.append({
            "Day": day,
            "Minutes": 0,
            "StackIndex": -1,
            "Color": "rgba(0,0,0,0)"
        })

        for idx, (_, m) in enumerate(stacks):
            rows.append({
                "Day": day,
                "Minutes": m,
                "StackIndex": idx,
                "Color": COLOR_PALETTE[idx % len(COLOR_PALETTE)]
            })

    return pd.DataFrame(rows)


def render_chart(df, title):
    """
    Render stacked bar chart with improved styling
    """
    chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X(
                "Day:N",
                sort=DAYS,
                scale=alt.Scale(paddingInner=0.5, paddingOuter=0.3),
                axis=alt.Axis(labelFontSize=12, titleFontSize=12)
            ),
            y=alt.Y(
                "Minutes:Q",
                stack=True,
                axis=alt.Axis(labelFontSize=12, titleFontSize=12)
            ),
            color=alt.Color("Color:N", scale=None, legend=None),
            order=alt.Order("StackIndex:Q"),
            tooltip=[
                alt.Tooltip("Day:N", title="Day"),
                alt.Tooltip("Minutes:Q", title="Minutes")
            ]
        )
        .properties(
            title=title,
            height=340,
            width="container"
        )
        .interactive()
    )

    st.altair_chart(chart, use_container_width=True, theme=None)


"""
UI Layout - Tabs with improved spacing
"""
st.markdown("### 📅 Weekly Productivity Tracker")

tabs = st.tabs(DAYS)

for idx, day in enumerate(DAYS):
    with tabs[idx]:
        col_m, col_a = st.columns(2, gap="large")

        """
        Morning Block
        """
        with col_m:
            st.markdown("#### 🌅 Morning")

            stacks_morning = st.session_state.week_data[day]["morning"]

            with st.expander("📋 View stacks", expanded=False):
                if stacks_morning:
                    for i, (stack_type, minutes) in enumerate(stacks_morning, 1):
                        emoji = "💼" if stack_type == "work" else "☕"
                        st.write(f"{i}. {emoji} {stack_type.capitalize()} - {minutes}min")
                else:
                    st.info("No data yet")

            col_min, col_action = st.columns([1, 2], gap="small")

            with col_min:
                minutes_m = st.number_input(
                    "Minutes",
                    min_value=1,
                    max_value=300,
                    value=50,
                    key=f"{day}_morning_min",
                    label_visibility="collapsed"
                )

            with col_action:
                btn_col1, btn_col2 = st.columns(2, gap="small")
                with btn_col1:
                    if st.button("💼 Work", key=f"{day}_morning_work", use_container_width=True):
                        add_stack(day, "morning", "work", minutes_m)
                        st.rerun()

                with btn_col2:
                    if st.button("☕ Rest", key=f"{day}_morning_rest", use_container_width=True):
                        add_stack(day, "morning", "rest", minutes_m)
                        st.rerun()

            col_action1, col_action2 = st.columns(2, gap="small")
            with col_action1:
                if st.button("↶ Remove", key=f"{day}_morning_remove", use_container_width=True):
                    remove_stack(day, "morning")
                    st.rerun()

            with col_action2:
                if st.button("🗑️ Clear", key=f"{day}_morning_clear", use_container_width=True):
                    clear_block(day, "morning")
                    st.rerun()

            work_m, rest_m = summarize_block(day, "morning")

            st.markdown("---")
            st.markdown("**Efficiency Check**")
            col_eff1, col_eff2 = st.columns(2)

            with col_eff1:
                status = "🟢" if rest_m <= work_m else "🔴"
                st.metric("Rest ≤ Work", f"{status} {rest_m}/{work_m}")

            with col_eff2:
                status = "🟢" if work_m >= 120 else "🔴"
                st.metric("Work ≥ 120min", f"{status} {work_m}min")

        """
        Afternoon Block
        """
        with col_a:
            st.markdown("#### 🌤️ Afternoon")

            stacks_afternoon = st.session_state.week_data[day]["afternoon"]

            with st.expander("📋 View stacks", expanded=False):
                if stacks_afternoon:
                    for i, (stack_type, minutes) in enumerate(stacks_afternoon, 1):
                        emoji = "💼" if stack_type == "work" else "☕"
                        st.write(f"{i}. {emoji} {stack_type.capitalize()} - {minutes}min")
                else:
                    st.info("No data yet")

            col_min, col_action = st.columns([1, 2], gap="small")

            with col_min:
                minutes_a = st.number_input(
                    "Minutes",
                    min_value=1,
                    max_value=300,
                    value=50,
                    key=f"{day}_afternoon_min",
                    label_visibility="collapsed"
                )

            with col_action:
                btn_col1, btn_col2 = st.columns(2, gap="small")
                with btn_col1:
                    if st.button("💼 Work", key=f"{day}_afternoon_work", use_container_width=True):
                        add_stack(day, "afternoon", "work", minutes_a)
                        st.rerun()

                with btn_col2:
                    if st.button("☕ Rest", key=f"{day}_afternoon_rest", use_container_width=True):
                        add_stack(day, "afternoon", "rest", minutes_a)
                        st.rerun()

            col_action1, col_action2 = st.columns(2, gap="small")
            with col_action1:
                if st.button("↶ Remove", key=f"{day}_afternoon_remove", use_container_width=True):
                    remove_stack(day, "afternoon")
                    st.rerun()

            with col_action2:
                if st.button("🗑️ Clear", key=f"{day}_afternoon_clear", use_container_width=True):
                    clear_block(day, "afternoon")
                    st.rerun()

            work_a, rest_a = summarize_block(day, "afternoon")

            st.markdown("---")
            st.markdown("**Efficiency Check**")
            col_eff1, col_eff2 = st.columns(2)

            with col_eff1:
                status = "🟢" if rest_a <= work_a else "🔴"
                st.metric("Rest ≤ Work", f"{status} {rest_a}/{work_a}")

            with col_eff2:
                status = "🟢" if work_a >= 120 else "🔴"
                st.metric("Work ≥ 120min", f"{status} {work_a}min")

"""
Weekly Overview - Summary Charts
"""
st.markdown("---")
st.markdown("### 📊 Weekly Overview")

chart_col1, chart_col2 = st.columns(2, gap="large")

with chart_col1:
    st.markdown("**Morning Sessions**")
    render_chart(build_chart_df("morning"), "Morning Productivity")

with chart_col2:
    st.markdown("**Afternoon Sessions**")
    render_chart(build_chart_df("afternoon"), "Afternoon Productivity")

"""
Summary Statistics
"""
st.markdown("---")
st.markdown("### 📈 Weekly Statistics")

week_morning_work = sum(
    summarize_block(day, "morning")[0] for day in DAYS
)
week_morning_rest = sum(
    summarize_block(day, "morning")[1] for day in DAYS
)
week_afternoon_work = sum(
    summarize_block(day, "afternoon")[0] for day in DAYS
)
week_afternoon_rest = sum(
    summarize_block(day, "afternoon")[1] for day in DAYS
)

total_work = week_morning_work + week_afternoon_work
total_rest = week_morning_rest + week_afternoon_rest

stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4, gap="small")

with stat_col1:
    st.metric("📅 Total Work", f"{total_work}h" if total_work >= 60 else f"{total_work}min", delta=None)

with stat_col2:
    st.metric("☕ Total Rest", f"{total_rest}h" if total_rest >= 60 else f"{total_rest}min", delta=None)

with stat_col3:
    work_ratio = (total_work / (total_work + total_rest) * 100) if (total_work + total_rest) > 0 else 0
    st.metric("📊 Work Ratio", f"{work_ratio:.0f}%", delta=None)

with stat_col4:
    daily_avg = total_work // 7 if total_work > 0 else 0
    st.metric("📆 Daily Avg", f"{daily_avg}min", delta=None)
