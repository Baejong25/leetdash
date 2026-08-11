import java.util.*;

// 무방향 가중치 그래프의 최소 시간 
// s 가 시작지점일때 가능한 경우의 수는
// 1.S-A-B
// 2.S-B-A
// 3.S-B + S-A
// 4.S-?-A + S-?-B
// 가 있으며 이들중 최소가 답임.

// 이 모든 경우의수는 4번에서 ?에 모두 포함됨.
// 그렇다면 우리는 S - R - A , S - R - B 로 거리를 구하는 알고리즘이 필요한데,
// 이 형태는 dist[i][j] =  Math.min(dist[i][j], dist[i][k] + dist[k][j]) 의
// floyd warshall로 정리가능.

// 각 정점에서 한 쌍에 대해서 최단거리를 정하는 알고리즘.
// 모든 정점에 대해 정리했을때,
// 임의의 정점 R을 선택하고, S-R + R-A + R-B 를 더하면된다.
// R이 각 파라미터 값과 같을때 아까 초기화해둔 0이 되면서 위의 모든 경우의수를 포함하게됨.

class Solution {
    public int solution(int n, int s, int a, int b, int[][] fares) {
        int answer = 0;
        
        int[][] floydWarshallGraph = new int[n+1][n+1];
        for (int i = 0 ; i  < n + 1; i++) {
            Arrays.fill(floydWarshallGraph[i], 30000000);
            floydWarshallGraph[i][i] = 0;
        }
        
        for (int[] fare : fares) {
            int from = fare[0];
            int to = fare[1];
            int f = fare[2];
            floydWarshallGraph[from][to] = f;
            floydWarshallGraph[to][from] = f;
        }
        
        
        for (int k = 1; k <= n; k++) {
            for (int i = 1; i <= n; i++) {
                for (int j = 1; j <= n; j++) {
                    floydWarshallGraph[i][j] = Math.min(floydWarshallGraph[i][j], floydWarshallGraph[i][k] + floydWarshallGraph[k][j]);
                }
            }
        }
        
        int min = Integer.MAX_VALUE;
        
        for (int r = 1; r <= n; r++) {
                min = Math.min(min,
                                floydWarshallGraph[s][r] + floydWarshallGraph[r][a] + floydWarshallGraph[r][b]
                );
            
        }
        
        
        
        return min;
    }
}
