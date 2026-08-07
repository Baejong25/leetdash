// 선수의 수는 1명 이상 100명 이하입니다.
// 경기 결과는 1개 이상 4,500개 이하입니다.
// results 배열 각 행 [A, B]는 A 선수가 B 선수를 이겼다는 의미입니다.

// 문제 정리

// 문제 정리하면 
// 1. 순위확정문제는 floyd marshall을 통해 모든 직-간접 방향성 연결을 반영한 그래프를 만든 후 
// 2. 각 노드에서 자신이 연결된 floyd marshall그래프를 통해서 방향성이 있으므로 from->to, to->from 이 둘 중 하나라도있다면 이 노드와 연결된 노드라는 의미이고. 
// 3.이 연결된 개수가 자기자신을 제외한 n-1 과 같다면 순위가 확정된것과 마찬가지라는의미
// 왜냐하면 순위를 확정하기 위해선 
// 이 노드로 향하는, 즉 이 노드보다 낮은 to->from
// 이 노드가 향하는, 즉 이 노드보다 높은 from->to 로 연결된 개수가 확정되어야 
// 하기때문.
class Solution {
	public int solution(int n, int[][] results) {
		int answer = 0;
		boolean[][] graph = new boolean[n + 1][n + 1];
		boolean[][] floydWarshallGraph;

		// 인접행렬 생성.
		// O(100 * 100)
		// graph[i][j] -> i번 선수가 j번 선수를 이김.
		for (int i = 0; i < results.length; i++) {
			int from = results[i][0];
			int to = results[i][1];
			graph[from][to] = true;
		}

		// floydWarshallGraph
		floydWarshallGraph = graph.clone();
		for (int i = 0; i <= n; i++) {
			floydWarshallGraph[i] = graph[i].clone();
		}

		floydWarshall(floydWarshallGraph, n);

		for (int i = 1; i <= n; i++) {
			int c = 0;

			for (int j = 1; j <= n; j++) {
				if (i == j) // self
					continue;

				if (floydWarshallGraph[i][j] || floydWarshallGraph[j][i])
					c++;

			}

			if (c == n - 1)
				answer++;
		}

		return answer;
	}

	// O(V^3)
	private void floydWarshall(boolean[][] floydWarshallGraph, int n) {
		// floyd-marshall
		// 간접연결을 모두 true로 전환하는 로직.
		for (int k = 1; k <= n; k++) {
			for (int i = 1; i <= n; i++) {
				for (int j = 1; j <= n; j++) {
					if (floydWarshallGraph[i][k] && floydWarshallGraph[k][j])
						floydWarshallGraph[i][j] = true;
				}
			}
		}
	}
}
