import java.util.Arrays;

class Solution {
    public int solution(int n, int[] lost, int[] reserve) {
        int answer = 0;

        // 입력 정렬 안되어있는건 몰랐네;;
        Arrays.sort(lost);
        Arrays.sort(reserve);

		int[] clothes = new int[n];
		Arrays.fill(clothes, 1);

		for (int r : reserve) {
			clothes[r - 1] += 1;
		}

		for (int l : lost) {
			clothes[l - 1] -= 1;
		}

		for (int r : reserve) {
			int rIdx = r - 1;

			if (clothes[rIdx] < 2) {
                continue;
            }
			if (rIdx > 0 && clothes[rIdx - 1] == 0) {
				clothes[rIdx - 1] += 1;
				continue;
			}

			if (rIdx < n - 1 && clothes[rIdx + 1] == 0) {
				clothes[rIdx + 1] += 1;
				continue;
			}
		}

		for (int c : clothes) {
			if (c > 0)
				answer++;
		}

		return answer;
    }
}

