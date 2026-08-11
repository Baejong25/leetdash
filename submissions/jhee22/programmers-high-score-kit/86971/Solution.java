/*
    송전탑을 이을 tree 구조 구현 : <Integer>[] 을 원소로 갖는 ArrayList 구현
    

*/ 
import java.util.*;
class Solution {
     public int dfs(int curr, ArrayList<Integer>[] graph, boolean[] visited, int cut1, int cut2) {
        int cnt = 1; 
         
        // 현재 curr 방문 표시 
        visited[curr] = true; 
        
        // graph[curr] 의 next 를 순회 
        for (int next : graph[curr]) {
            // 이미 방문했으면 건너 뜀 
            if (visited[next]) {
                continue; 
            }
            
            // 끊어진 전선줄이면 건너 뜀 
            if ((curr == cut1 && next == cut2) || (curr == cut2 && next == cut1)) {
                continue; 
            }

            // 아니면 dfs() 호출 
            cnt += dfs(next, graph, visited, cut1, cut2);  
            
        }
        
        return cnt; 
    }
    
    public int solution(int n, int[][] wires) { 
        // (1) 송전탑을 이을 ArrayList<Integer>[] 자료형 구현 
        ArrayList<Integer>[] graph = new ArrayList[n+1]; 
        for (int i = 0; i <= n; i++) {
            graph[i] = new ArrayList<>(); 
        }
        
        // (2) 양방향 연결, graph[0] = [], 송전탑 번호가 1부터 시작하니 무시 
        for (int i = 0; i < wires.length; i++) {
            int p1 = wires[i][0]; 
            int p2 = wires[i][1];
            graph[p1].add(p2); 
            graph[p2].add(p1);
            
        }
        // System.out.println(Arrays.toString(graph));
        int min = Integer.MAX_VALUE; 
        for (int[] w : wires) {
            // 하나씩 끊을 전선의 끝점 
            int cut1 = w[0]; 
            int cut2 = w[1];
            
            // 이번 전선만 끊었을 때 사용할 새로운 visited 
            boolean[] visited = new boolean[n+1]; 
                
            // 1번 송전탑부터 dfs 시작 
            int cnt = dfs(1, graph, visited, cut1, cut2); 
            // 반대쪽 개수 
            int other = n - cnt; 
            int diff = Math.abs(cnt-other); 
            min = Math.min(diff, min); 
        }
        
        return min; 
    }
}