import java.util.*;

class Solution {
    class Dijkstra {
        int node;
        int dist;
        Dijkstra(int node, int dist) {
            this.node = node;
            this.dist = dist;
        }
    }

    public int solution(int n, int[][] edge) {
        int answer = 0;
        HashMap<Integer, HashSet<Integer>> map = new HashMap<>();
        for (int i = 0 ; i < edge.length; i++) {
            int from = edge[i][0];
            int to = edge[i][1];
            
            if (!map.containsKey(from))
                map.put(from, new HashSet<Integer>());
            if (!map.containsKey(to))
                map.put(to, new HashSet<Integer>());
            
            map.get(from).add(to);
            map.get(to).add(from);
        }
        
		PriorityQueue<Dijkstra> queue = new PriorityQueue<>(new Comparator<Dijkstra>() {
			@Override
			public int compare(Dijkstra d1, Dijkstra d2) {
				return d1.dist - d2.dist;
			}
		});
		int[] Dist = new int[n+1];
		Arrays.fill(Dist, -1);
		Dist[0] = 0;
		Dist[1] = 0;
        queue.add(new Dijkstra(1, 0));
		while (!queue.isEmpty()) {
			Dijkstra d = queue.poll();

            for (Integer k: map.get(d.node)) {                
                int to = k;
                int from = d.node;
                if (Dist[to] == -1) {
                    Dist[to] = Dist[from] + 1;
                    queue.add(new Dijkstra(to, Dist[to]));
                } else if (Dist[from]  < Dist[to] - 1) {
			    	Dist[to] = Dist[from] + 1;
                    queue.add(new Dijkstra(to, Dist[to]));
                }
            }
		}

		PriorityQueue<Integer> q = new PriorityQueue<>(Collections.reverseOrder());
		for (int d : Dist) {
			q.add(d);
		}

		int max = q.peek();
		while (!q.isEmpty() && q.peek() == max) {
			
            q.poll();
			answer++;
		}
		return answer;
    }
}
