// 선수의 수는 1명 이상 100명 이하입니다.
// 경기 결과는 1개 이상 4,500개 이하입니다.
// results 배열 각 행 [A, B]는 A 선수가 B 선수를 이겼다는 의미입니다.
// 이긴 순으로 정렬하돼, 순위를 정확하게 정할수있다, 없다의 의미는 어떻게파악하나?
// 모든 경기 결과에는 모순이 없습니다. -> 순환의존성이 없다. -> DAG
// 사이클이 없는 방향그래프 조건 만족.
//
//
import java.util.*;

class Solution {
    public int solution(int n, int[][] results) {
        int answer = 0;
        
        int[] indegree = new int[n+1];
        boolean[][] graph = new boolean[n+1][n+1];
        
        // create indegrees
        // [_, -,-,-,-]
        for (int i = 0; i  < results.length; i++) {
            indegree[results[i][1]]++;
        }
        
        // graph[i][j] -> i번 선수가 j번 선수를 이김.
        for (int i =0; i < results.length; i++) {
            int from = results[i][0];
            int to = results[i][1];
            graph[from][to] = true;
        }
        
        System.out.println(Arrays.toString(indegree));
        LinkedList<Integer> queue = new LinkedList<>();
        LinkedList<Integer> removedNodeQueue = new LinkedList<>();
        
        while (true) {
            if (queue.isEmpty())
                return answer;
            
            int c = 0;
            // 쓰기전용
            int[] c_indegree = indegree.clone();
            for (int i = 1; i < c_indegree.length; i++) {
                // 이 정점을 향하는 간선이 없음 
                if (indegree[i] == 0) {
                    removedNodeQueue.add(i);
                    // 이 정점이 outbound로 가는 간선 제거 반영
                    int from = i;
                    for (int j = 1; j < graph[from].length; j++) {
                        if (graph[from][j] == true) {
                            c_indegree[j]--;
                        }
                    }
                    c++;
                }
            }

            indegree = c_indegree;
            if (c == 1) {
                int node = removedNodeQueue.getLast();
            }
        }
    }
}
