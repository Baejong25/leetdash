// 섬의 개수 n은 1 이상 100 이하입니다.
// costs의 길이는 ((n-1) * n) / 2이하입니다.
// 임의의 i에 대해, costs[i][0] 와 costs[i] [1]에는 다리가 연결되는 두 섬의 번호가 들어있고, costs[i] [2]에는 이 두 섬을 연결하는 다리를 건설할 때 드는 비용입니다.
// 같은 연결은 두 번 주어지지 않습니다. 또한 순서가 바뀌더라도 같은 연결로 봅니다. 즉 0과 1 사이를 연결하는 비용이 주어졌을 때, 1과 0의 비용이 주어지지 않습니다.
// 모든 섬 사이의 다리 건설 비용이 주어지지 않습니다. 이 경우, 두 섬 사이의 건설이 불가능한 것으로 봅니다.
// 연결할 수 없는 섬은 주어지지 않습니다.

import java.util.*;

class Solution {
	class Edge {
		int cost;
		int from;
		int to;
		Edge(int cost, int from, int to) {
			this.cost = cost;
			this.from = from;
			this.to = to;
		}
        
        @Override
        public String toString() {
            return "from:"+ from + " to:" + to + " cost:" + cost; 
        }
	}

    public int solution(int n, int[][] costs) {
        int answer = 0;

		PriorityQueue<Edge> q = new PriorityQueue<>(new Comparator<Edge>() {
			@Override
			public int compare(Edge e1, Edge e2) {
				return e1.cost - e2.cost;
			}
		});

		int[] parent = {};
		// 우선순위큐로 정렬
		for (int[] cost : costs) {
			int c = cost[2];
			int from = Math.min(cost[0], cost[1]);
			int to = Math.max(cost[0], cost[1]);
			q.add(new Edge(c, from, to));
		}


		// 초기값 세팅.
		parent = new int[n];
		for (int i = 0 ; i < n; i++){
			parent[i] = i;
		}
		
		while (!q.isEmpty()) {
			Edge e = q.poll();
			answer += unionSet(e, parent);
		}
		return answer;
    }


	// 현재 값의 부모를 찾는 함수
	private int findRepresentation(int x, int[] parent) {
		// 내가 루트임! 
		if (parent[x] == x)
			return x;

		// 내가 루트가 아님 -> 내 위에 누군가 있음.
		// 재귀적으로 호출하면 결국 root반환
		int root = findRepresentation(parent[x], parent);
		// 나랑 연결된 애들 중 루트는 얘임!
		parent[x] = root;
		return root;
	}


	private int unionSet(Edge e, int[] parent) {
		int from = e.from;
		int to = e.to;

		// 싸이클 검출
		int fromRoot = findRepresentation(from, parent);
		int toRoot = findRepresentation(to, parent);

		// 이 둘의 조상이 같다 -> 이미 연결되어있다 -> 한번 더 연결하면 싸이클검출문제 발생.
		if (fromRoot == toRoot)
			return 0;

		// 둘이 조상을 같게한다 -> 같은 집합으로 만들기.
		parent[toRoot] = fromRoot;
		// 연결되었으므로 비용추가
		return e.cost;
	}
}
