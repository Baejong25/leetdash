import java.util.*;

// rectangle의 세로(행) 길이는 1 이상 4 이하입니다.
// rectangle의 원소는 각 직사각형의 [좌측 하단 x, 좌측 하단 y, 우측 상단 x, 우측 상단 y] 좌표 형태입니다.
// 직사각형을 나타내는 모든 좌표값은 1 이상 50 이하인 자연수입니다.
// 서로 다른 두 직사각형의 x축 좌표, 혹은 y축 좌표가 같은 경우는 없습니다.
// 문제에 주어진 조건에 맞는 직사각형만 입력으로 주어집니다.
// charcterX, charcterY는 1 이상 50 이하인 자연수입니다.
// 지형을 나타내는 다각형 테두리 위의 한 점이 주어집니다.
// itemX, itemY는 1 이상 50 이하인 자연수입니다.
// 지형을 나타내는 다각형 테두리 위의 한 점이 주어집니다.
// 캐릭터와 아이템의 처음 위치가 같은 경우는 없습니다.
class Solution {
	static int answer;
	static final int[] ROWS = { 0, 0, 1, -1 };
	static final int[] COLS = { 1, -1, 0, 0 };
	static final boolean[][] visited = new boolean[102][102];

	public int solution(int[][] rectangle, int characterX, int characterY, int itemX, int itemY) {
		answer = 0;

		Doubled d = new Doubled(rectangle, characterX, characterY, itemX, itemY);

		LinkedList<BFSStatus> lst = new LinkedList<>();

		lst.add(new BFSStatus(0, d.characterX, d.characterY));
		while (!lst.isEmpty()) {
			BFSStatus s = lst.pollFirst();
			bfs(lst, d, s);
		}

		return answer / 2;
	}

	void bfs(LinkedList<BFSStatus> lst, Doubled d, BFSStatus s) {
		if (d.itemX == s.characterX && d.itemY == s.characterY) {
			if (answer != 0 && s.step < answer)
				answer = s.step;
			else if (answer == 0)
				answer = s.step;
			return;
		}

		visited[s.characterX][s.characterY] = true;

		for (int i = 0; i < 4; i++) {
			final int NEWROW = ROWS[i] + s.characterX;
			final int NEWCOL = COLS[i] + s.characterY;

			if (BFSStatus.alreadyVisited(s, visited, NEWROW, NEWCOL))
				continue;

			// 1.현재 좌표가 특정 직사각형의 edge인지 판별한다.
			int curRectI = -1;
			for (int k = 0; k < d.rectangles.length; k++) {
				int[] rectangle = d.rectangles[k];
				// edge판정: x가 같고, y가 범위내인가 or y가 같고 x가 범위내인가
				if ((NEWROW == rectangle[0] || NEWROW == rectangle[2]) &&
						(NEWCOL >= rectangle[1] && NEWCOL <= rectangle[3])) {
					curRectI = i;
					break;
				}

				if ((NEWCOL == rectangle[1] || NEWCOL == rectangle[3]) &&
						(NEWROW >= rectangle[0] && NEWROW <= rectangle[2])) {
					curRectI = i;
					break;
				}
			}
			if (curRectI == -1)
				continue;

			// 2.다른 직사각형의 내부를 거쳐선 안된다.
			boolean isInOthers = false;
			for (int k = 0; k < d.rectangles.length; k++) {
				int[] rectangle = d.rectangles[k];

				if (NEWROW > rectangle[0] && NEWROW < rectangle[2] &&
						NEWCOL > rectangle[1] && NEWCOL < rectangle[3]) {
					isInOthers = true;
					break;
				}
			}

			if (isInOthers)
				continue;

			// 추가
			BFSStatus n = s.cpy();
			n.moveTo(NEWROW, NEWCOL);
			// System.out.printf("add currentStep: %d\n", n.step);
			// System.out.printf("from: r: %.1f, c: %.1f\n", (double)s.characterX / 2,
			// (double)s.characterY / 2);
			// System.out.printf("to : r: %.1f, c: %.1f\n", (double)NEWROW / 2,
			// (double)NEWCOL / 2);

			lst.add(n);
		}

	}

	class BFSStatus {
		int step;
		int characterX;
		int characterY;

		BFSStatus(
				int step,
				int characterX, int characterY) {
			this.step = step;
			this.characterX = characterX;
			this.characterY = characterY;
		}

		BFSStatus cpy() {
			BFSStatus b = new BFSStatus(this.step, this.characterX, this.characterY);
			return b;
		}

		void moveTo(int newCharacterX, int newCharacterY) {
			this.characterX = newCharacterX;
			this.characterY = newCharacterY;
			this.step += 1;
		}

		static boolean alreadyVisited(BFSStatus s, boolean[][] visited, int X, int Y) {
			if (visited[X][Y])
				return true;
			return false;
		}

		void updateVisited() {
			visited[characterX][characterY] = true;
		}
	}

	class Doubled {
		int[][] rectangles;
		int characterX;
		int characterY;
		int itemX;
		int itemY;

		Doubled(int[][] rectangle, int characterX, int characterY, int itemX, int itemY) {
			this.rectangles = new int[rectangle.length][4];
			for (int i = 0; i < rectangle.length; i++) {
				for (int j = 0; j < 4; j++) {
					this.rectangles[i][j] = rectangle[i][j] * 2;
				}
			}
			this.characterX = characterX * 2;
			this.characterY = characterY * 2;
			this.itemX = itemX * 2;
			this.itemY = itemY * 2;
		}
	}
}
