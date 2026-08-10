import java.util.*;

// 격자의 크기 m, n은 1 이상 100 이하인 자연수입니다.
// m과 n이 모두 1인 경우는 입력으로 주어지지 않습니다.
// 물에 잠긴 지역은 0개 이상 10개 이하입니다.
// 집과 학교가 물에 잠긴 경우는 입력으로 주어지지 않습니다.
class Solution {
    public int solution(int m, int n, int[][] puddles) {
        int[][] map = new int[m + 1][n + 1];
        // LinkedList<Bfs> queue = new LinkedList<>();
        HashMap<Integer, HashSet<Integer>> puddleSet = new HashMap<>();
        
        for (int[] p:puddles) {
            int x = p[0];
            int y = p[1];
            if (!puddleSet.containsKey(x))
                puddleSet.put(x, new HashSet<>());
            puddleSet.get(x).add(y);
        }
        map[1][1] = 1;
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (i == 1 && j== 1)
                    continue;
                // outofbounds
                if (i >= m + 1 || j >= n + 1)
                    continue;
                // puddle.
                if (puddleSet.containsKey(i)) {
                    if (puddleSet.get(i).contains(j))
                        continue;
                }
                
                map[i][j] = (map[i-1][j] + map[i][j-1])% 1000000007;
            }
        }
        
        
//         queue.add(new Bfs(1,1));
//         while (!queue.isEmpty()) {
//             Bfs s=  queue.pollFirst();
            
//             if (s.x == m && s.y == n) {
//                 map[s.x][s.y] +=1;
//                 continue;
//             }
            
//             for (int i = 0; i  <2; i++) {
//                 final int r = ROWS[i] + s.x;
//                 final int c = COLS[i] + s.y;
                
//                 if (r >= m + 1 || c >= n + 1)
//                     continue;
//                 if (puddleSet.containsKey(r)) {
//                     if (puddleSet.get(r).contains(c))
//                         continue;
//                 }
//                 if (r == m && c == n) {
//                     map[r][c] += 1;
//                     continue;
//                 }
                
//                 queue.add(new Bfs(r, c));
//             }
//         }
         
        int answer = map[m][n] % 1000000007;
        return answer;
    }
    
    class Bfs {
        int x;
        int y;
        Bfs(int x, int y) {
            this.x = x;
            this.y = y;
        }
    }
}
