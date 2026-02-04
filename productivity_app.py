import streamlit as st
import pandas as pd
import altair as alt

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

"""
Initialize application state
"""
if "week_data" not in st.session_state:
    st.session_state.week_data = {
        day: {block: [] for block in BLOCKS} for day in DAYS
    }

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


def remove_stack(day, block):
    stacks = st.session_state.week_data[day][block]
    if stacks:
        stacks.pop()


def clear_block(day, block):
    st.session_state.week_data[day][block] = []


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
