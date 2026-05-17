import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats: submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
          profile {
            ranking
            reputation
          }
        }
        allQuestionsCount {
          difficulty
          count
        }
      }
    `;

    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { username } }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "LeetCode API request failed" }, { status: 502 });
    }

    const json = await res.json();
    const user = json.data?.matchedUser;
    if (!user) {
      return NextResponse.json({ error: "LeetCode user not found" }, { status: 404 });
    }

    const submissions = user.submitStats?.acSubmissionNum || [];
    const allQuestions = json.data?.allQuestionsCount || [];

    const getCount = (arr: Array<{ difficulty: string; count: number }>, diff: string) =>
      arr.find((a) => a.difficulty === diff)?.count || 0;

    const easySolved = getCount(submissions, "Easy");
    const mediumSolved = getCount(submissions, "Medium");
    const hardSolved = getCount(submissions, "Hard");
    const totalSolved = getCount(submissions, "All");

    const easyTotal = getCount(allQuestions, "Easy");
    const mediumTotal = getCount(allQuestions, "Medium");
    const hardTotal = getCount(allQuestions, "Hard");

    const ranking = user.profile?.ranking || 0;

    // LeetCode doesn't expose streak via public GraphQL; use 0 as default
    const globalPercentile = ranking > 0
      ? `Top ${Math.max(1, Math.round((ranking / 500000) * 100))}%`
      : "N/A";

    return NextResponse.json({
      username: user.username,
      totalSolved,
      easy: { solved: easySolved, total: easyTotal },
      medium: { solved: mediumSolved, total: mediumTotal },
      hard: { solved: hardSolved, total: hardTotal },
      ranking,
      streak: 0,
      globalPercentile,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch LeetCode data" }, { status: 500 });
  }
}
