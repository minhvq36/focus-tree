import streamlit as st
import pandas as pd
import altair as alt
import json
import os

st.set_page_config(page_title="Productivity Tracker", layout="wide")

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
    chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X(
                "Day:N",
                sort=DAYS,
                scale=alt.Scale(paddingInner=0.6, paddingOuter=0.3)
            ),
            y=alt.Y("Minutes:Q", stack=True),
            color=alt.Color("Color:N", scale=None, legend=None),
            order=alt.Order("StackIndex:Q")
        )
        .properties(
            title=title,
            height=380
        )
    )

    st.altair_chart(chart, use_container_width=True)


"""
UI Tabs
"""
tabs = st.tabs(DAYS)

for idx, day in enumerate(DAYS):
    with tabs[idx]:
        st.subheader(day)

        col1, col2 = st.columns(2)

        for col, block in zip([col1, col2], BLOCKS):
            with col:
                st.markdown(f"### {block.capitalize()}")

                stacks = st.session_state.week_data[day][block]

                with st.expander("View stacks", expanded=False):
                    st.write(stacks if stacks else "No data")

                c1, c2, c3 = st.columns(3)

                with c1:
                    minutes = st.number_input(
                        "Minutes",
                        min_value=1,
                        max_value=300,
                        value=50,
                        key=f"{day}_{block}_min"
                    )

                with c2:
                    if st.button("Add Work", key=f"{day}_{block}_add_work"):
                        add_stack(day, block, "work", minutes)

                with c3:
                    if st.button("Add Rest", key=f"{day}_{block}_add_rest"):
                        add_stack(day, block, "rest", minutes)

                if st.button("Remove Last", key=f"{day}_{block}_remove"):
                    remove_stack(day, block)

                if st.button(f"Clear {block.capitalize()}", key=f"{day}_{block}_clear"):
                    clear_block(day, block)

                work, rest = summarize_block(day, block)

                st.markdown("#### Efficiency Checklist")

                st.write(
                    f"Rest time ≤ Work time: "
                    f"{'🟢' if rest <= work else '🔴'} ({rest} / {work})"
                )
                st.write(
                    f"Work time ≥ 120 min: "
                    f"{'🟢' if work >= 120 else '🔴'} ({work})"
                )

"""
Charts
"""
st.markdown("---")
st.subheader("Weekly Overview")

render_chart(build_chart_df("morning"), "Morning Blocks")
render_chart(build_chart_df("afternoon"), "Afternoon Blocks")
