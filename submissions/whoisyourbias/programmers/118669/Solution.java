import java.util.*;
import java.util.Map.*;

/*
 * [등산코스 정하기]
 *
 * 핵심:
 * 일반적인 다익스트라는 "거리의 합"을 최소화하지만,
 * 이 문제는 경로에서 가장 큰 간선의 가중치(intensity)를 최소화한다.
 *
 * 따라서 다음 노드로 이동할 때 비용은
 *
 *     newIntensity = max(현재까지의 intensity, 현재 간선 weight)
 *
 * 로 계산한다.
 *
 *
 * -------------------------
 * 1. 처음 접근
 * -------------------------
 *
 * 처음에는 각 경로별로 visited[]를 들고 다니면서
 * 산봉우리에 도달할 때까지 PriorityQueue로 탐색했다.
 *
 * 문제:
 *
 *     boolean[] visited
 *
 * 를 PQ 상태마다 가지고 있었고,
 * 다음 노드로 갈 때마다
 *
 *     visited.clone()
 *
 * 을 수행했다.
 *
 * 즉 경로 하나를 확장할 때마다 O(N) 배열 복사가 발생했다.
 *
 * 또한 "같은 노드에 더 좋은 intensity로 이미 도착했는가?"를
 * 저장하지 않았기 때문에 동일 노드를 여러 경로로 계속 탐색했다.
 *
 * 결과:
 *
 * - 시간 초과
 * - 메모리 초과
 *
 *
 * -------------------------
 * 2. 해결 아이디어
 * -------------------------
 *
 * 경로 자체를 기억할 필요가 없다.
 *
 * 중요한 것은
 *
 *     "이 노드까지 도달할 수 있는 최소 intensity"
 *
 * 뿐이다.
 *
 * 따라서 일반 다익스트라의 dist[]처럼
 *
 *     intensity[node]
 *
 * 를 둔다.
 *
 *
 * 일반 다익스트라:
 *
 *     newDist = dist[cur] + weight
 *
 * 이 문제:
 *
 *     newIntensity = max(intensity[cur], weight)
 *
 *
 * 그리고
 *
 *     newIntensity < intensity[next]
 *
 * 일 때만 갱신하고 PriorityQueue에 넣는다.
 *
 *
 * -------------------------
 * 3. 같은 intensity면 왜 다시 탐색하지 않는가?
 * -------------------------
 *
 * 어떤 노드 X에 intensity=5로 이미 도착했다고 하자.
 *
 * 다른 경로에서도 X에 intensity=5로 도착했다면,
 * 이후 X에서 갈 수 있는 간선은 동일하다.
 *
 * 예를 들어 다음 간선 weight가 7이라면
 *
 *     max(5, 7) = 7
 *
 * 으로 결과도 동일하다.
 *
 * 따라서 같은 노드 + 같은 intensity 상태는
 * 다시 탐색할 필요가 없다.
 *
 *
 * -------------------------
 * 4. PQ에 남아 있는 오래된 상태 처리
 * -------------------------
 *
 * 예:
 *
 *     intensity[5] = 10  -> PQ에 (5,10)
 *     intensity[5] = 7   -> PQ에 (5,7)
 *     intensity[5] = 3   -> PQ에 (5,3)
 *
 * PQ 안에는 예전에 넣은 (5,10), (5,7)이 남아 있을 수 있다.
 *
 * 하지만 현재 최적값이 intensity[5] = 3이라면
 * 10, 7짜리 상태를 다시 확장할 필요가 없다.
 *
 * 따라서 poll 직후:
 *
 *     if (intensity[cur] < pqIntensity)
 *         continue;
 *
 * 로 stale 상태를 제거한다.
 *
 *
 * -------------------------
 * 5. Multi-source Dijkstra
 * -------------------------
 *
 * 입구가 여러 개 존재한다.
 *
 * 각 입구마다 다익스트라를 따로 돌릴 필요 없이
 * 모든 gate를 intensity=0으로 PQ에 동시에 넣는다.
 *
 * 즉:
 *
 *     gate1 -> 0
 *     gate2 -> 0
 *     gate3 -> 0
 *
 * 로 시작하는 Multi-source Dijkstra이다.
 *
 *
 * -------------------------
 * 6. 문제 조건 처리
 * -------------------------
 *
 * - 다른 gate로 들어가면 안 됨
 *      => gatesMap.containsKey(to)면 continue
 *
 * - summit에 도착하면 그 경로는 종료
 *      => 정답 후보만 갱신하고 더 진행하지 않음
 *
 *
 * -------------------------
 * 최종 시간복잡도
 * -------------------------
 *
 * 일반적인 PriorityQueue 기반 다익스트라와 동일하게
 *
 *     O(E log V)
 *
 * 수준으로 동작한다.
 */

class Solution {

    public int[] solution(int n, int[][] paths, int[] gates, int[] summits) {

        int[] answer = { -1, -1 };

        /*
         * graph[from] = { to -> weight }
         *
         * 무방향 그래프이므로 양쪽 방향 모두 저장한다.
         */
        HashMap<Integer, HashMap<Integer, Integer>> graph = new HashMap<>();

        // summit인지 O(1)에 확인하기 위한 Map
        HashMap<Integer, Integer> summitsMap = new HashMap<>();

        // gate인지 O(1)에 확인하기 위한 Map
        HashMap<Integer, Integer> gatesMap = new HashMap<>();

        for (int s : summits) {
            summitsMap.put(s, 1);
        }

        for (int g : gates) {
            gatesMap.put(g, 1);
        }

        /*
         * 그래프 생성
         */
        for (int[] path : paths) {

            int from = path[0];
            int to = path[1];
            int weight = path[2];

            if (!graph.containsKey(from))
                graph.put(from, new HashMap<>());

            if (!graph.containsKey(to))
                graph.put(to, new HashMap<>());

            graph.get(from).put(to, weight);
            graph.get(to).put(from, weight);
        }

        /*
         * intensity가 작은 경로부터 탐색한다.
         *
         * 일반 다익스트라에서 dist 기준 min-heap을 사용하는 것과 동일하다.
         */
        PriorityQueue<Dijkstra> queue = new PriorityQueue<>(
            new Comparator<Dijkstra>() {
                @Override
                public int compare(Dijkstra d1, Dijkstra d2) {
                    return d1.intensity - d2.intensity;
                }
            }
        );

        /*
         * intensity[i]
         *
         * 어떤 gate에서 출발하든
         * i번 노드까지 도달할 수 있는 최소 intensity
         *
         * -1은 아직 방문하지 않았음을 의미한다.
         */
        int[] intensity = new int[n + 1];
        Arrays.fill(intensity, -1);

        /*
         * 모든 gate를 시작점으로 동시에 넣는다.
         *
         * Multi-source Dijkstra
         */
        for (int g : gates) {

            queue.add(new Dijkstra(0, g));
            intensity[g] = 0;
        }

        while (!queue.isEmpty()) {

            Dijkstra d = queue.poll();

            /*
             * stale entry 제거
             *
             * PQ에 넣었을 당시에는 최적 경로였지만,
             * 큐에서 나오기 전에 다른 경로에서
             * 더 작은 intensity를 발견했을 수 있다.
             *
             * 예:
             *
             * PQ: (node=4, intensity=7)
             *
             * 그런데 현재
             *
             * intensity[4] = 3
             *
             * 이라면 intensity=7 상태는 더 이상 볼 필요가 없다.
             */
            if (intensity[d.cur] != -1 &&
                intensity[d.cur] < d.intensity) {

                continue;
            }

            /*
             * 현재 노드에서 갈 수 있는 모든 간선 확인
             */
            for (Entry<Integer, Integer> e
                    : graph.get(d.cur).entrySet()) {

                int from = d.cur;
                int to = e.getKey();
                int weight = e.getValue();

                /*
                 * 이 문제에서의 다익스트라 relaxation
                 *
                 * 거리의 합이 아니라
                 * 경로에서 가장 큰 간선 weight가 intensity이다.
                 */
                int intense = Math.max(
                    weight,
                    d.intensity
                );

                /*
                 * 다른 입구를 중간 경로로 사용할 수 없다.
                 */
                if (gatesMap.containsKey(to))
                    continue;

                /*
                 * 산봉우리에 도착했다면 경로 종료.
                 *
                 * 해당 산봉우리까지의 intensity를 정답 후보로 사용한다.
                 */
                if (summitsMap.containsKey(to)) {

                    if (answer[0] == -1) {

                        answer[0] = to;
                        answer[1] = intense;

                    } else {

                        /*
                         * intensity가 더 작은 산봉우리 선택
                         */
                        if (intense < answer[1]) {

                            answer[0] = to;
                            answer[1] = intense;

                        /*
                         * intensity가 같다면
                         * 번호가 작은 산봉우리 선택
                         */
                        } else if (intense == answer[1]) {

                            answer[0] = Math.min(
                                to,
                                answer[0]
                            );

                            answer[1] = intense;
                        }
                    }

                    /*
                     * summit은 더 이상 outbound 탐색하지 않는다.
                     */
                    intensity[to] = intense;
                    continue;
                }

                /*
                 * 아직 방문하지 않은 노드라면
                 * 현재 intensity가 최초 최적값.
                 */
                if (intensity[to] == -1) {

                    intensity[to] = intense;

                    queue.add(
                        new Dijkstra(
                            intense,
                            to
                        )
                    );

                } else {

                    /*
                     * 기존 경로보다 새로운 경로의
                     * intensity가 크다면 볼 필요 없음.
                     */
                    if (intensity[to] < intense) {

                        continue;

                    /*
                     * 더 좋은 intensity를 발견한 경우에만
                     * dist 갱신 + PQ 삽입
                     */
                    } else if (intensity[to] > intense) {

                        intensity[to] = intense;

                        queue.add(
                            new Dijkstra(
                                intensity[to],
                                to
                            )
                        );

                    /*
                     * intensity[to] == intense
                     *
                     * 같은 노드까지 동일 intensity로 도달한 상태.
                     *
                     * 이후 결과도 동일하므로
                     * 다시 PQ에 넣지 않는다.
                     *
                     * 처음 구현에서 이 상태도 PQ에 넣어서
                     * 2 -> 4 -> 2 -> 4 ...
                     * 처럼 동일 상태가 반복되어 실행 중단이 발생했다.
                     */
                    } else {
                        // do nothing
                    }
                }
            }
        }

        return answer;
    }

    /*
     * PriorityQueue에 저장하는 상태.
     *
     * 처음에는 visited[]도 가지고 있었지만,
     * 다익스트라에서는 경로 전체가 아니라
     * "현재 노드 + 현재까지의 최소 비용"만 있으면 된다.
     */
    class Dijkstra {

        int intensity;
        int cur;

        Dijkstra(
            int intensity,
            int cur
        ) {
            this.intensity = intensity;
            this.cur = cur;
        }

        @Override
        public String toString() {
            return " " + this.intensity;
        }
    }
}
// ```

// ### 기억할 핵심 한 줄

// **일반 다익스트라의 `dist[cur] + weight`를 `max(intensity[cur], weight)`로 바꾼 문제.**

// 그리고 네가 이번 문제에서 실제로 배운 포인트는 이것으로 기억하면 된다.

// > **다익스트라는 경로를 저장하는 알고리즘이 아니라, 각 노드까지의 현재 최선의 비용을 저장하면서 더 나쁜 경로를 제거하는 알고리즘이다.**
