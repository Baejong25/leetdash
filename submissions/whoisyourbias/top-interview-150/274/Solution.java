import java.util.Arrays;

class Solution {
    public int hIndex(int[] citations) {
    	Arrays.sort(citations);
        int max_h = 0;
        for (int h = 0; h < citations.length + 1; h++) {
            if (citations[Math.min(citations.length - h, citations.length - 1)] >= h) {max_h = h;}
        }

        return max_h;
	}
}

