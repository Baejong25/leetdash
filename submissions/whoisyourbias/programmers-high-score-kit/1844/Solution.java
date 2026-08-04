import java.util.LinkedList;


/**
 *
 *
 *maps는 n x m 크기의 게임 맵의 상태가 들어있는 2차원 배열로, n과 m은 각각 1 이상 100 이하의 자연수입니다.
n과 m은 서로 같을 수도, 다를 수도 있지만, n과 m이 모두 1인 경우는 입력으로 주어지지 않습니다.
maps는 0과 1로만 이루어져 있으며, 0은 벽이 있는 자리, 1은 벽이 없는 자리를 나타냅니다.
처음에 캐릭터는 게임 맵의 좌측 상단인 (1, 1) 위치에 있으며, 상대방 진영은 게임 맵의 우측 하단인 (n, m) 위치에 있습니다.
 *
 *
 * */

class Solution {

	static int count;
	static final int[] ROWS = {0,0,1,-1};
	static final int[] COLS = {1,-1,0,0};
	static int endX;
	static int endY;

    public int solution(int[][] maps) {
		LinkedList<BFSSTATUS> lst = new LinkedList<>();
		boolean[][] visited = new boolean[maps.length][maps[0].length];
		endX = maps.length - 1;
		endY = maps[0].length - 1;
        count = -1;

		BFSSTATUS init = new BFSSTATUS(0, 0, 1);

		lst.add(init);
		while (!lst.isEmpty()) {
			BFSSTATUS polled = lst.pollFirst();
            // System.out.printf("x %d, y %d, c %d\n",polled.x, polled.y, polled.moveCount);
			bfs(polled, visited, lst, maps);
		}
        
		return count;
    }

	class BFSSTATUS {
		final int x;
		final int y;
		int moveCount;
		BFSSTATUS(int x, int y, int moveCount) {
			this.x = x;
			this.y = y;
			this.moveCount = moveCount;
		}
	}


	public void bfs(BFSSTATUS bs, boolean[][] visited, LinkedList<BFSSTATUS> lst, int[][] maps) {
		// end
		if (bs.x == Solution.endX && bs.y == Solution.endY) {
			// 종료
			count = bs.moveCount;
			lst.clear();
			return;
		}
        
        // 
        if (visited[bs.x][bs.y] == true)
            return;

		visited[bs.x][bs.y] = true;
	
		for (int i = 0; i < 4; i++) {
			int newX = bs.x + ROWS[i];
			int newY = bs.y + COLS[i];

			// in range
			if (newX < 0 || newX > endX || newY < 0 || newY > endY)
				continue;

            // 새로 갈 좌표가 방문한상태면 큐에 넣지않음.
			if (visited[newX][newY] == true)
				continue;

			// walls
			if (maps[newX][newY] == 0)
				continue;

            
            // !! 새로 갈 좌표가 방문한 상태가 아님.
            // 그러나 큐의 마지막으로 추가하는 것이기때문에 이미 큐에 해당좌표로가는 상태가 있었다면 중복연산하기때문에 52번line에서 중복체크로 막아야 불필요한 연산을 줄일 수 있음.
			lst.addLast(new BFSSTATUS(newX, newY, bs.moveCount + 1));
		}
	}
}
