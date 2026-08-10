/* 
    문제 풀이 : 일단 다 돌아보죠? 
    80 -> 50 -> 30 
    80 -> 30 -> 50 ... 
*/

import java.util.*; 
class Solution {
    // 클래수 변수로 선언 
    int max = Integer.MIN_VALUE; 
        
    public void dfs(int k, int[][] dungeons, boolean[] visited, int cnt){
    for (int i = 0; i < dungeons.length; i++) {
        // 카운트의 최대값 갱신
        max = Math.max(max, cnt); 
        
        // (1) 방문 여부 확인
        if (visited[i]) {
            continue;
        }
        
        // (2) 방문 조건 확인 
        if (k >= dungeons[i][0]){
            // 방문 표시 
            visited[i] = true; 
            // 다음 dfs 호출 시 깎인 피로도와, 늘어난 카운트를 전달 
            dfs(k-dungeons[i][1], dungeons, visited, cnt+1); 
            // 방문 취소 (백트레킹)
            visited[i] = false; 
            }
        }
    }
    public int solution(int k, int[][] dungeons) {
        // 변수 선언
        boolean[] visited = new boolean[dungeons.length]; 
        int cnt = 0; 
        
        dfs(k, dungeons, visited, cnt); 
        return max;
    }
}