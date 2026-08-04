import java.util.HashSet;

class Solution {
	public int solution(int n, int[][] wires) {
        int answer = -1;
        
        
        for (int i = 0 ; i < wires.length; i++) {
            HashSet<Integer> a = new HashSet<>();
            HashSet<Integer> b = new HashSet<>();
            
            boolean[] visited = new boolean[wires.length];
            // 간선 하나 끊기
            visited[i] = true;
            for (int j =0; j < wires.length; j++) {
                if (visited[j])
                    continue;
                
                if (a.size() == 0) {
                    a.add(wires[j][0]);
                    a.add(wires[j][1]);
                    visited[j] = true;
                    j = -1;
                    continue;
                }
                
                if (a.contains(wires[j][0]) || a.contains(wires[j][1])) {
                    a.add(wires[j][0]);
                    a.add(wires[j][1]);
                    visited[j] = true;
                    j = -1;
                    continue;
                }
            }
            
            for (int j = 0; j < wires.length; j++) {
                if (!visited[j]) {
                    b.add(wires[j][0]);
                    b.add(wires[j][1]);
                }
            }
            
            // 최초 간선의 노드 반영
            if (a.contains(wires[i][0])) {
                a.add(wires[i][0]);
                b.add(wires[i][1]);
            } else {
                a.add(wires[i][1]);
                b.add(wires[i][0]);
            }
            
			if (answer == -1 ) {
				answer = Math.abs(a.size() - b.size());
			} else {
				if (answer > Math.abs(a.size() - b.size())) {
					answer = Math.abs(a.size() -b.size());
				}
			}
        }
        return answer;
    }
}
